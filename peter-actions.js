import 'dotenv/config'
import { signIn } from './auth.js'
import { createTask, updateTaskStatus, addComment } from './tasks.js'

// 1. On récupère les données d'authentification pour avoir l'ID de Peter
const authData = await signIn(process.env.PETER_ACTION_TEST_MAIL, process.env.TEST_MDP) 
const PROJECT_ID = process.env.PROJECT_ID

console.log('🚀 Peter commence ses actions...')

// 2. On assigne la tâche à Peter lors de la création pour qu'il ait le droit de la modifier
const task = await createTask(PROJECT_ID, {
  title: 'Implémenter le Realtime', 
  priority: 'high',
  assignedTo: authData.user.id // <--- C'EST ICI QUE LA MAGIE OPÈRE !
})
await new Promise(r => setTimeout(r, 1000))

await updateTaskStatus(task.id, 'in_progress')
await new Promise(r => setTimeout(r, 1000))

await addComment(task.id, 'Je commence maintenant !')
console.log('✅ Actions terminées !')