import { toast as hotToast } from 'react-hot-toast';

export type ToastProps = {
  title: string;
  description: string;
  variant?: 'default' | 'destructive' | 'success';
};

export function useToast() {
  return {
    toast: ({ title, description, variant = 'default' }: ToastProps) => {
      const message = `${title}: ${description}`;
      switch (variant) {
        case 'destructive':
          hotToast.error(message);
          break;
        case 'success':
          hotToast.success(message);
          break;
        default:
          hotToast(message);
      }
    }
  };
} 