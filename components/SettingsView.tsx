import React from 'react';
import { Settings, Save, Server, Bell, Shield } from 'lucide-react';

export default function SettingsView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Server size={20} className="text-blue-600" />
            System Configuration
          </h3>
          <p className="text-sm text-gray-500 mt-1">Manage environment variables and storage paths.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Storage Directory</label>
            <input type="text" disabled value="/var/lib/finlitte/data" className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-500" />
            <p className="text-xs text-gray-400 mt-1">Configured via environment variables.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-yellow-600" />
            Notifications (Coming Soon)
          </h3>
          <p className="text-sm text-gray-500 mt-1">Configure email alerts for expiring contracts.</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 bg-yellow-50 text-yellow-800 rounded-lg">
            <Shield size={20} />
            <span>SMTP Configuration will be available in the next update.</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  );
}