export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRequest {
  customerId: string;
  items: OrderItem[];
}

export interface OrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}