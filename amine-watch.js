import 'dotenv/config'
import { signIn } from './auth.js'
import { subscribeToProject } from './realtime.js'

await signIn(process.env.AMINE_ACTION_TEST_MAIL, process.env.TEST_MDP) 
const PROJECT_ID = process.env.PROJECT_ID

const unsub = subscribeToProject(PROJECT_ID, {
  onTaskCreated:   (t) => console.log('✅ Nouvelle tâche:', t.title),
  onTaskUpdated:   (n, o) => console.log(`🔄 ${o.status} → ${n.status}`),
  onCommentAdded:  (c) => console.log('💬', c.content),
  onPresenceChange:(u) => console.log('👥 En ligne:', u.length),
})

console.log('👀 Amine écoute le projet en temps réel... (Ne ferme pas ce terminal)')
process.on('SIGINT', () => { unsub(); process.exit() })