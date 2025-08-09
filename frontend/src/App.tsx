import { useEffect } from 'react';
import { ApiService } from './api';

export default function App() {
  useEffect(() => {
    const fetchData = async () => {
      const response = await ApiService.app.appControllerGetHello();
      console.log(response);
    };
    fetchData();
    console.log('App component mounted');
  }, []);
  return <h1>Vite + React</h1>;
}
