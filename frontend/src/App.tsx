import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { ApiService } from './api';
import './index.css';

export default function App() {
  useEffect(() => {
    const fetchData = async () => {
      const response = await ApiService.app.appControllerGetHello();
      console.log(response);
    };
    fetchData();
    console.log('App component mounted');
  }, []);
  return <>
    <Button>test</Button>
  <h1>Vite + React</h1>
  </>;
}
