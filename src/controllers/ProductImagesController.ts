import { ProductImages } from "@prisma/client";
import { Request, Response } from "express";

import { prisma } from "../database";

import { DiskStorage } from "../providers/DiskStorage";
import { AppError } from "../utils/AppError";

export class ProductImagesController {
  async create(request: Request, response: Response) {
    const userId = request.user.id;
    const productId = request.body.product_id;
    const productFiles = request.files

    const diskStorage = new DiskStorage();

    const product = await prisma.products.findUnique({
      where: {
        id: productId,
      }
    })

    if (!productFiles || productFiles?.length === 0 || !Array.isArray(productFiles)) {
      throw new AppError("Uploading images is mandatory.")
    }
    
    if (!product) {
      productFiles.forEach(async (productFilename) => {
        await diskStorage.deleteFile(productFilename.path)
      })
      throw new AppError("Product not found.", 404);
    }

    if (product.user_id !== userId) {
      productFiles.forEach(async (productFilename) => {
        await diskStorage.deleteFile(productFilename.path)
      })
      throw new AppError("Only the product owner may manage its pictures.", 401);
    }

    const productImages: ProductImages[] = []

    if (Array.isArray(productFiles)) {
      for (const productFilename of productFiles) {
        const filename = await diskStorage.saveFile(productFilename.filename);
        const productImage = await prisma.productImages.create({
          data: {
            path: filename,
            product_id: productId
          }
        })

        productImages.push(productImage)
      }
    } else {
      throw new AppError("Invalid image format.");
    }

    return response.status(201).json(productImages);
  }

  async delete(request: Request, response: Response) {
    const userId = request.user.id;
    const productImagesIds = request.body.productImagesIds;

    const diskStorage = new DiskStorage();

    if (productImagesIds.length === 0) {
      throw new AppError("Images id is mandatory so it can be deleted.")
    }

    const productImages = await prisma.productImages.findMany({
      where: {
        id: {
          in: productImagesIds
        }
      },
      include: {
        product: {
          select: {
            user_id: true
          }
        }
      }
    })
    
    if (productImages.length !== productImagesIds.length) {
      throw new AppError("Images not found.", 404);
    }

    for (const productImage of productImages) {
      if (productImage.product.user_id !== userId) {
        throw new AppError("Only the product owner may manage its pictures.", 401);
      }
    }

    for (const productImage of productImages) {
      await diskStorage.deleteFile(productImage.path)
    }

    await prisma.productImages.deleteMany({
      where: {
        id: {
          in: productImagesIds
        }
      }
    })

    return response.status(204).json()
  }
}