import { supabase } from './client.js'

export function subscribeToProject(projectId, callbacks) {
  const channel = supabase.channel(`project:${projectId}`)

  // Écoute les changements sur la table tasks
  channel.on('postgres_changes',
    { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
    (payload) => {
      if (payload.eventType === 'INSERT') callbacks.onTaskCreated?.(payload.new)
      if (payload.eventType === 'UPDATE') callbacks.onTaskUpdated?.(payload.new, payload.old)
      if (payload.eventType === 'DELETE') callbacks.onTaskDeleted?.(payload.old)
    }
  )

  // Écoute les nouveaux commentaires
  channel.on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'comments' },
    (payload) => callbacks.onCommentAdded?.(payload.new)
  )

  // Présence : qui est actuellement connecté sur le projet
  channel.on('presence', { event: 'sync' }, () => {
    const users = Object.values(channel.presenceState()).flat()
    callbacks.onPresenceChange?.(users)
  })

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      const { data: { user } } = await supabase.auth.getUser()
      await channel.track({ username: user?.email, online_at: new Date().toISOString() })
    }
  })

  // Retourne une fonction pour se désabonner
  return () => supabase.removeChannel(channel)
}