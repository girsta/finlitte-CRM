import React, { useState, useEffect } from 'react';
import { Task, User } from '../types';
import { CheckCircle, Circle, Trash2, Plus, Calendar, User as UserIcon, Edit2, X } from 'lucide-react';

interface TaskManagerProps {
  currentUser: User;
}

interface DBUser {
  id: number;
  username: string;
  role: string;
}

export default function TaskManager({ currentUser }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create/Edit Task Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    if (currentUser.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDueDate('');
    setEditingTask(null);
    setIsFormOpen(false);
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedTo(task.assigned_to);
    // Ensure date is YYYY-MM-DD for input
    setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
    setIsFormOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          description, 
          assigned_to: assignedTo || currentUser.username, 
          due_date: dueDate 
        })
      });

      if (res.ok) {
        resetForm();
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      
      await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error(e);
      fetchTasks(); // Revert on error
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      setTasks(prev => prev.filter(t => t.id !== id));
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
  };

  const canManage = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Task Manager</h2>
          <p className="text-gray-500">Track assignments and to-dos.</p>
        </div>
        {canManage && !isFormOpen && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New Task
          </button>
        )}
      </div>

      {/* Create/Edit Task Form */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold">{editingTask ? 'Edit Task' : 'Assign New Task'}</h3>
             <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSaveTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select User...</option>
                {users.map(u => (
                  <option key={u.id} value={u.username}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingTask ? 'Update Task' : 'Assign Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            No tasks found.
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${task.status === 'completed' ? 'border-gray-200 bg-gray-50' : 'border-blue-100'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <button 
                    onClick={() => toggleStatus(task)}
                    className={`mt-1 transition-colors ${task.status === 'completed' ? 'text-green-500' : 'text-gray-300 hover:text-blue-500'}`}
                  >
                    {task.status === 'completed' ? <CheckCircle size={24} /> : <Circle size={24} />}
                  </button>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-lg ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </h4>
                    <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                        <UserIcon size={12} />
                        <span>To: {task.assigned_to}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">By:</span> {task.created_by}
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          <Calendar size={12} />
                          {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                     <button
                        onClick={() => openEditForm(task)}
                        className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Task"
                     >
                       <Edit2 size={18} />
                     </button>
                     <button 
                        onClick={() => handleDelete(task.id)}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Task"
                     >
                        <Trash2 size={18} />
                     </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}