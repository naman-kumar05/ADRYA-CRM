export type FormState = {
  error?: string;
  duplicate?: {
    id: string;
    code: string;
    name: string;
    city: string;
    state: string;
    leads: { code: string; productName: string; status: string }[];
  };
} | null;
