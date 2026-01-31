export type Profile = {
  id: string;
  display_name: string;
  family_id: string;
};

export type Category = {
  id: string;
  family_id: string;
  name: string;
  icon: string;
  color: number;
};

export type Transaction = {
  id: string;
  family_id: string;
  created_by: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category_id: string;
  payment_method: string;
  description: string;
  created_at: string;
};
