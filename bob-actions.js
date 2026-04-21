import { signIn } from './auth.js'
import { createTask, updateTaskStatus, addComment } from './tasks.js'

await signIn('bob@example.com', 'password')

const PROJECT_ID = 'VOTRE-PROJECT-ID'

const task = await createTask(PROJECT_ID, {
  title: 'Implémenter le Realtime',
  priority: 'high',
})

await new Promise(r => setTimeout(r, 1000))
await updateTaskStatus(task.id, 'in_progress')

await new Promise(r => setTimeout(r, 1000))
await addComment(task.id, 'Je commence maintenant !')