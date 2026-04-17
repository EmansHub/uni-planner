import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner 
      position="top-right" 
      richColors 
      toastOptions={{
        style: {
          minWidth: '300px',
          whiteSpace: 'nowrap',
        },
      }}
    />
  );
}