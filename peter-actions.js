import 'dotenv/config'
import { signIn } from './auth.js'
import { createTask, updateTaskStatus, addComment } from './tasks.js'

const authData = await signIn(process.env.PETER_ACTION_TEST_MAIL, process.env.TEST_MDP) 
const PROJECT_ID = process.env.PROJECT_ID

console.log('🚀 Peter commence ses actions...')

const task = await createTask(PROJECT_ID, {
  title: 'Implémenter le Realtime', 
  priority: 'high',
  assignedTo: authData.user.id 
})
await new Promise(r => setTimeout(r, 1000))

await updateTaskStatus(task.id, 'in_progress')
await new Promise(r => setTimeout(r, 1000))

await addComment(task.id, 'Je commence maintenant !')
console.log('✅ Actions terminées !')