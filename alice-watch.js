import { signIn } from './auth.js'
import { subscribeToProject } from './realtime.js'

await signIn('alice@example.com', 'password')

const PROJECT_ID = 'VOTRE-PROJECT-ID'

const unsub = subscribeToProject(PROJECT_ID, {
  onTaskCreated:  (t)    => console.log('✅ Nouvelle tâche :', t.title),
  onTaskUpdated:  (n, o) => console.log(`🔄 ${o.status} → ${n.status}`),
  onCommentAdded: (c)    => console.log('💬', c.content),
  onPresenceChange:(u)   => console.log('👥 En ligne :', u.length),
})

process.on('SIGINT', () => { unsub(); process.exit() })