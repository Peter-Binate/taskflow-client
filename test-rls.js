import { supabase } from './client.js'
import { signIn, signOut } from './auth.js'

// Test 1 : sans auth → on ne doit rien voir
const { data: noAuth } = await supabase.from('tasks').select('')
console.log('Sans auth:', noAuth?.length, '(attendu: 0)')

// Test 2 : Amine voit ses tâches
await signIn('amine@test.com', 'azerty1234567') 
const { data: tasks } = await supabase.from('tasks').select('')
console.log('Tasks Amine:', tasks?.length)

// Test 3 : Amine ne peut pas modifier la tâche de Peter
const { data: peterTask } = await supabase
  .from('tasks').select('id').eq('assigned_to', 'ccadb3c6-8c39-4346-a878-76ca2e997111').single()

const { error } = await supabase
  .from('tasks').update({ title: 'Hacked' }).eq('id', peterTask?.id)
console.log('Modif refusée:', error?.message ?? '⚠ ERREUR : accès accordé !')

await signOut()