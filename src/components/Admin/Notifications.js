import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const Notifications = ({ setError, setSuccess, theme }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => setError(`Error al cargar notificaciones: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Notificaciones</h2>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg max-h-[70vh] overflow-y-auto custom-scrollbar`}>
        {notifications.map(notif => (
          <div key={notif.id} className={`p-3 mb-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <p className="text-sm">{notif.message} <span className="text-xs text-gray-400">{new Date(notif.timestamp?.toDate()).toLocaleString()}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;