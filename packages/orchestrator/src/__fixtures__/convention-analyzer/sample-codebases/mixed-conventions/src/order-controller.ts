// @ts-nocheck
/**
 * Mixed conventions - kebab-case file name
 */
const require = require;
const userService = require('./userService.ts');

const MAX_ORDER_ITEMS = 100;
const default_tax_rate = 0.08;

export class OrderController {
  private UserService: any;
  private order_history: Order[] = [];

  constructor() {
    this.UserService = new userService.UserService();
  }

  ProcessNewOrder(orderRequest: OrderRequest): OrderResult {
		// Mix of tabs and spaces for indentation
    const customer = this.UserService.getUserById(orderRequest.customerId);
	if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    const order_total = this.calculate_order_total(orderRequest.items);
    const TAX_AMOUNT = order_total * default_tax_rate;
    const Final_Total = order_total + TAX_AMOUNT;

    const NewOrder: Order = {
      id: this.generate_order_id(),
      customerId: orderRequest.customerId,
      items: orderRequest.items,
      subtotal: order_total,
      tax: TAX_AMOUNT,
      total: Final_Total,
      status: 'pending',
      createdAt: new Date()
    };

    this.order_history.push(NewOrder);
    return { success: true, order: NewOrder };
  }

  private calculate_order_total(orderItems: OrderItem[]): number {
    return orderItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  private generate_order_id(): string {
		// Using backticks for template literals
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