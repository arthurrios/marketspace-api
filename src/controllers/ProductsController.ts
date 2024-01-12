import { Request, Response } from "express";

import { prisma } from "../database";
import { DiskStorage } from "../providers/DiskStorage";

import { AppError } from "../utils/AppError";

export class ProductsController {
  async show(request: Request, response: Response) {
    const productId = request.params.id

    const product = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      include: {
        product_images: {
          select: {
            path: true,
            id: true
          }
        },
        payment_methods: {
          select: {
            key: true,
            name: true
          }
        },
        user: {
          select: {
            avatar: true,
            name: true,
            tel: true
          }
        }
      }
    })

    if (!product) {
      throw new AppError('Product not found.', 404);
    }

    return response.json(product);
  }

  async index(request: Request, response: Response) {
    const userId = request.user.id

    const is_new = request.query.is_new === undefined ? undefined : request.query.is_new === 'true'
    const accept_trade = request.query.accept_trade === undefined ? undefined : request.query.accept_trade === 'true'
    const query = typeof request.query.query === 'string' ? request.query.query : undefined
    const payment_methods = request.query.payment_methods === undefined ? undefined : typeof request.query.payment_methods === 'string' ? new Array(request.query.payment_methods) : request.query.payment_methods as string[];
    
    const products = await prisma.products.findMany({
      where: {
        user_id: {
          not: userId
        },
        is_active: true,
        is_new,
        accept_trade,
        payment_methods: {
          some: {
            key: {
              in: Array.isArray(payment_methods) && payment_methods.length > 0 ? payment_methods : undefined
            }
          }
        },
        name: {
          contains: query
        }
      },
      select: {
        id: true,
        name: true,
        price: true,
        is_new: true,
        accept_trade: true,
        product_images: {
          select: {
            path: true,
            id: true
          }
        },
        payment_methods: {
          select: {
            key: true,
            name: true
          }
        },
        user: {
          select: {
            avatar: true
          }
        }
      }
    })

    return response.json(products);
  }

  async create(request: Request, response: Response) {
    const { 
      name,
      description,
      is_new,
      price,
      accept_trade,
      payment_methods
    } = request.body
    const userId = request.user.id

    if (!name) {
      throw new AppError("Product name is required.")
    }

    if (!description) {
      throw new AppError("Product description is required.")
    }

    if (typeof is_new === 'string' ? !is_new : typeof is_new === undefined) {
      throw new AppError("Product condition (new or used) is required.")
    }

    if (!price) {
      throw new AppError("Product price is required.")
    }

    if (typeof accept_trade === 'string' ? !accept_trade : typeof accept_trade === undefined) {
      throw new AppError("Trade condition is required.")
    }

    if (!Array.isArray(payment_methods) || payment_methods.length === 0) {
      throw new AppError("Payment methods are required.")
    }

    const arePaymentsMethodsValid = await prisma.paymentMethods.findMany({
      where: {
        key: {
          in: payment_methods
        }
      }
    })

    if (arePaymentsMethodsValid.length !== payment_methods.length) {
      throw new AppError("One or more payment methods are invalid.")
    }

    const product = await prisma.products.create({
      data: {
        accept_trade,
        description,
        is_new,
        name,
        payment_methods: {
          connect: payment_methods.map(payment_method => ({
            key: payment_method
          }))
        },
        price,
        user_id: userId
      }
    })

    return response.status(201).json(product);
  }

  async update(request: Request, response: Response) {
    const {
      name,
      description,
      is_new,
      price,
      accept_trade,
      payment_methods 
    } = request.body
    const userId = request.user.id
    const productId = request.params.id

    const product = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      include: {
        payment_methods: {
          select: {
            key: true
          }
        }
      }
    })

    if (!product) {
      throw new AppError("Product to be updated not found.", 404)
    }

    if (product.user_id !== userId) {
      throw new AppError("User does not have permission to update the product", 401)
    }

    let newPaymentsMethods: string[] | undefined
    let oldPaymentsMethods: string[] | undefined

    if (Array.isArray(payment_methods)) {
      if (payment_methods.length === 0) {
        throw new AppError("The product must have at least 1 payment method.")
      }

      const arePaymentsMethodsValid = await prisma.paymentMethods.findMany({
        where: {
          key: {
            in: payment_methods
          }
        }
      })
  
      if (arePaymentsMethodsValid.length !== payment_methods.length) {
        throw new AppError("One or more payment methods are invalid.")
      }

      oldPaymentsMethods = product.payment_methods.filter(payment_method => !payment_methods.includes(payment_method.key)).map(payment_method => payment_method.key)
      newPaymentsMethods = payment_methods.filter(payment_method => !product.payment_methods.includes(payment_method))
    }

    product.accept_trade = accept_trade ?? product.accept_trade
    product.description = description ?? product.description
    product.is_new = is_new ?? product.is_new
    product.name = name ?? product.name
    product.price = price ?? product.price
    product.updated_at = new Date()

    await prisma.products.update({
      data: {
        ...product,
        payment_methods: {
          disconnect: oldPaymentsMethods?.map(payment_method => ({
            key: payment_method
          })),
          connect: newPaymentsMethods?.map(payment_method => ({
            key: payment_method
          }))
        }
      },
      where: {
        id: productId
      }
    })

    return response.status(204).json();
  }

  async patch(request: Request, response: Response) {
    const {
      is_active
    } = request.body
    const userId = request.user.id
    const productId = request.params.id

    const product = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      include: {
        payment_methods: {
          select: {
            key: true
          }
        }
      }
    })

    if (!product) {
      throw new AppError("Product to be updated not found.", 404)
    }

    if (product.user_id !== userId) {
      throw new AppError("User does not have permission to update the product", 401)
    }


    await prisma.products.update({
      data: {
        is_active
      },
      where: {
        id: productId
      }
    })

    return response.status(204).json();
  }

  async delete(request: Request, response: Response) {
    const userId = request.user.id
    const productId = request.params.id

    const diskStorage = new DiskStorage();

    const product = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      include: {
        product_images: {
          select: {
            path: true
          }
        }
      }
    })

    if (!product) {
      throw new AppError("Product to be removed not found.", 404)
    }

    if (product.user_id !== userId) {
      throw new AppError("User does not have permission to update product.", 401)
    }

    for (const productImage of product.product_images) {
      await diskStorage.deleteFile(productImage.path)
    }

    await prisma.products.delete({
      where: {
        id: productId
      }
    })

    return response.status(204).json();
  }
}