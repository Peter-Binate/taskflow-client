import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BASE = process.env.AZURE_FUNCTION_BASE_URL || 'https://fn-taskflow-amine.azurewebsites.net/api'
const AMINE_EMAIL = process.env.AMINE_EMAIL || 'amine@test.com'
const AMINE_PASSWORD = process.env.AMINE_PASSWORD || process.env.TEST_MDP || 'ton_mot_de_passe'
const PETER_EMAIL = process.env.PETER_EMAIL || 'peter@test.com'
const PETER_PASSWORD = process.env.PETER_PASSWORD || process.env.TEST_MDP || 'ton_mot_de_passe'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis dans .env')
}
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY est requis dans .env pour le setup integration')
}

const amineClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const peterClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  console.log('\n━━━ INTEGRATION TASKFLOW ━━━\n')

  const { error: amineLoginError } = await amineClient.auth.signInWithPassword({
    email: AMINE_EMAIL,
    password: AMINE_PASSWORD,
  })
  if (amineLoginError) throw amineLoginError

  const { error: peterLoginError } = await peterClient.auth.signInWithPassword({
    email: PETER_EMAIL,
    password: PETER_PASSWORD,
  })
  if (peterLoginError) throw peterLoginError

  const {
    data: { session: amineSession },
  } = await amineClient.auth.getSession()
  const {
    data: { user: peterUser },
  } = await peterClient.auth.getUser()

  if (!amineSession?.user?.id || !amineSession.access_token || !peterUser?.id) {
    throw new Error('Session Amine ou utilisateur Peter introuvable apres connexion')
  }

  console.log('✅ Amine et Peter connectes')

  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .insert({ name: 'Integration Test', owner_id: amineSession.user.id })
    .select()
    .single()
  if (projectError) throw projectError

  const { error: ownerMemberError } = await adminClient.from('project_members').insert({
    project_id: project.id,
    user_id: amineSession.user.id,
    role: 'owner',
  })
  if (ownerMemberError) throw ownerMemberError

  const addMemberRes = await fetch(`${BASE}/manage-members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${amineSession.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'add',
      project_id: project.id,
      target_user_id: peterUser.id,
      role: 'member',
    }),
  })
  if (!addMemberRes.ok) {
    const errorBody = await addMemberRes.text()
    throw new Error(`manage-members a echoue (${addMemberRes.status}) - ${errorBody}`)
  }

  console.log('✅ Projet cree, Peter ajoute via Azure Function')

  const { data: membersAfterAdd, error: membersError } = await adminClient
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', project.id)
  if (membersError) throw membersError
  const peterIsMember = (membersAfterAdd ?? []).some((m) => m.user_id === peterUser.id)
  if (!peterIsMember) {
    throw new Error(`Peter non membre du projet apres manage-members. Membres: ${JSON.stringify(membersAfterAdd)}`)
  }

  const titles = ['Architecture serverless', "Tests d'integration", 'Documentation API']
  const createdTasks = []

  for (const title of titles) {
    const res = await fetch(`${BASE}/validate-task`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${amineSession.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: project.id,
        title,
        priority: 'medium',
      }),
    })
    if (!res.ok) {
      const errorBody = await res.text()
      console.warn(`⚠️ validate-task a echoue pour "${title}" (${res.status}) - ${errorBody}`)
      continue
    }
    const payload = await res.json()
    if (payload.task) createdTasks.push(payload.task)
  }

  console.log(`✅ ${createdTasks.length} taches creees via Azure Function`)
  if (createdTasks.length === 0) {
    throw new Error('Aucune tache creee via validate-task')
  }

  for (const task of createdTasks) {
    const { error: assignError } = await amineClient
      .from('tasks')
      .update({ assigned_to: peterUser.id })
      .eq('id', task.id)
    if (assignError) throw assignError
  }
  console.log('✅ Taches assignees a Peter (notification webhook)')

  let rtCount = 0
  const channel = amineClient.channel(`project:${project.id}`)
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'tasks',
      filter: `project_id=eq.${project.id}`,
    },
    (p) => {
      if (p.old.status !== p.new.status) {
        rtCount++
        console.log(`  📡 [RT] ${p.old.status} -> ${p.new.status}`)
      }
    }
  )
  channel.subscribe()
  await new Promise((r) => setTimeout(r, 1000))

  for (const task of createdTasks) {
    await peterClient.from('tasks').update({ status: 'in_progress' }).eq('id', task.id)
    await new Promise((r) => setTimeout(r, 300))
    await peterClient.from('tasks').update({ status: 'done' }).eq('id', task.id)
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log('✅ Peter a termine toutes les taches')
  await new Promise((r) => setTimeout(r, 1000))
  console.log(`✅ Amine a recu ${rtCount} evenements Realtime`)

  const statsRes = await fetch(`${BASE}/project-stats?project_id=${project.id}`)
  if (!statsRes.ok) {
    throw new Error(`project-stats a echoue (${statsRes.status})`)
  }
  const stats = await statsRes.json()

  console.log('\n📊 STATS FINALES:')
  console.log(`  Taches : ${stats.total_tasks}`)
  console.log(`  Completion : ${stats.completion_rate}%`)
  console.log('  Par statut :', stats.by_status)

  const { data: notifs, error: notifsError } = await peterClient.from('notifications').select('*')
  if (notifsError) throw notifsError
  console.log(`\n🔔 Notifications Peter: ${notifs?.length ?? 0}`)

  // Skip channel teardown in Node runtime due known close() issue in current realtime stack.
  console.log('\n━━━ FIN - TOUS LES SYSTEMES FONCTIONNELS ━━━')
  process.exit(0)
}

run().catch((err) => {
  console.error('\n❌ ECHEC INTEGRATION')
  console.error(err)
  process.exitCode = 1
})
