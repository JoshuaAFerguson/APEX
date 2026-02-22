/**
 * Order controller with consistent kebab-case naming
 */
import { UserService } from './user-service.js';

const MAX_ORDER_ITEMS = 100;
const DEFAULT_TAX_RATE = 0.08;

export class OrderController {
  private userService: UserService;
  private orderHistory: Order[] = [];

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Process new order
   */
  processNewOrder(orderRequest: OrderRequest): OrderResult {
    const customer = this.userService.getUserById(orderRequest.customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    const orderTotal = this.calculateOrderTotal(orderRequest.items);
    const taxAmount = orderTotal * DEFAULT_TAX_RATE;
    const finalTotal = orderTotal + taxAmount;

    const newOrder: Order = {
      id: this.generateOrderId(),
      customerId: orderRequest.customerId,
      items: orderRequest.items,
      subtotal: orderTotal,
      tax: taxAmount,
      total: finalTotal,
      status: 'pending',
      createdAt: new Date()
    };

    this.orderHistory.push(newOrder);
    return { success: true, order: newOrder };
  }

  /**
   * Calculate order total from items
   */
  private calculateOrderTotal(orderItems: OrderItem[]): number {
    return orderItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdAt: Date;
}

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderRequest {
  customerId: string;
  items: OrderItem[];
}

interface OrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}