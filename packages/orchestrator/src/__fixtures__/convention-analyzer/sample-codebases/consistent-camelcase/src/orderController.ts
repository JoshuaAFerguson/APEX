/**
 * Order controller with consistent camelCase naming
 */
import type { Order, OrderItem, OrderRequest, OrderResult } from './types/order.js';
import type { User } from './types/user.js';

import { UserService } from './userService.js';
import { validateInput } from './utils/validation.js';
import { logger } from './utils/logger.js';

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