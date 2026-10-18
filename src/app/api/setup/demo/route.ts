import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores, categories, products } from "@/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    // Create demo user
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email: "demo@sellup.ng",
      password: "demo123456", // Not hashed - for demo only
      fullName: "Demo User",
      isEmailVerified: true,
    });

    // Create demo store
    const storeId = uuidv4();
    await db.insert(stores).values({
      id: storeId,
      userId,
      storeName: "Fashion Hub",
      storeSlug: "fashion-hub",
      whatsappNumber: "+2348000000000",
      description: "Beautiful and affordable fashion for everyone",
      primaryColor: "#25D366",
      accentColor: "#34D399",
      isPublished: true,
    });

    // Create categories
    const category1Id = uuidv4();
    const category2Id = uuidv4();

    await db.insert(categories).values([
      {
        id: category1Id,
        storeId,
        name: "Clothing",
        slug: "clothing",
        description: "All kinds of clothing",
      },
      {
        id: category2Id,
        storeId,
        name: "Accessories",
        slug: "accessories",
        description: "Bags, shoes, and more",
      },
    ]);

    // Create demo products
    await db.insert(products).values([
      {
        id: uuidv4(),
        storeId,
        categoryId: category1Id,
        name: "Summer Dress",
        slug: "summer-dress",
        description: "Beautiful summer dress perfect for any occasion",
        price: "5000",
        stock: 50,
        isActive: true,
        isFeatured: true,
        images: [],
      },
      {
        id: uuidv4(),
        storeId,
        categoryId: category1Id,
        name: "Casual T-Shirt",
        slug: "casual-tshirt",
        description: "Comfortable and stylish t-shirt",
        price: "2500",
        stock: 100,
        isActive: true,
        isFeatured: true,
        images: [],
      },
      {
        id: uuidv4(),
        storeId,
        categoryId: category2Id,
        name: "Leather Bag",
        slug: "leather-bag",
        description: "Premium leather bag for daily use",
        price: "8000",
        stock: 20,
        isActive: true,
        isFeatured: true,
        images: [],
      },
      {
        id: uuidv4(),
        storeId,
        categoryId: category2Id,
        name: "Sneakers",
        slug: "sneakers",
        description: "Comfortable and stylish sneakers",
        price: "6500",
        stock: 30,
        isActive: true,
        isFeatured: false,
        images: [],
      },
    ]);

    return NextResponse.json(
      {
        message: "Demo store created successfully",
        storeSlug: "fashion-hub",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating demo store:", error);
    return NextResponse.json(
      { error: "Failed to create demo store" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
