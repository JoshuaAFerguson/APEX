// Mixed conventions - PascalCase file name
import { UserService } from './userService.js';

export class ProductModel {
  private product_id: string;
  private Product_Name: string;
  private base_price: number;

  constructor(productData: ProductInput) {
    this.product_id = productData.id;
    this.Product_Name = productData.name;
    this.base_price = productData.price;
  }

  // Mix of naming conventions in methods
  get_product_info(): ProductInfo {
    return {
      id: this.product_id,
      name: this.Product_Name,
      price: this.base_price
    };
  }

  UpdateProductPrice(newPrice: number): void {
		this.base_price = newPrice;
  }

  calculate_discounted_price(discount_percent: number): number {
    return this.base_price * (1 - discount_percent / 100);
  }
}

interface ProductInput {
  id: string;
  name: string;
  price: number;
}

interface ProductInfo {
  id: string;
  name: string;
  price: number;
}