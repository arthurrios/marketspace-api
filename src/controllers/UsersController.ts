import { hash } from "bcryptjs";
import { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/AppError";
import { prisma } from "../database";
import { DiskStorage } from "../providers/DiskStorage";

export class UsersController {
  async show(request: Request, response: Response) {
    const userId = request.user.id

    const user = await prisma.users.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        avatar: true,
        name: true,
        email: true,
        tel: true
      }
    })

    if (!user) {
      throw new AppError('O usuário não foi encontrado.', 404)
    }

    return response.json(user)
  }

  async create(request: Request, response: Response, next: NextFunction) {
    const { name, email, password, tel } = request.body;
    const avatarFile = request.file;
    const diskStorage = new DiskStorage();

    if (!avatarFile) {
      throw new AppError("Uploading avatar file is required.")
    }

    if (!name || !email || !password || !tel) {
      await diskStorage.deleteFile(avatarFile.path)
      throw new AppError("Enter all fields (name, email, phone and password).");
    }
    
    const checkUserEmailExists = await prisma.users.findUnique({
      where: {
        email
      }
    })

    if (checkUserEmailExists) {
      await diskStorage.deleteFile(avatarFile.path)
      throw new AppError("This email is already in use.", 401);
    }

    const checkUserTelExists = await prisma.users.findUnique({
      where: {
        tel
      }
    })

    if (checkUserTelExists) {
      await diskStorage.deleteFile(avatarFile.path)
      throw new AppError("This phone is already in use.", 401);
    }

    const hashedPassword = await hash(password, 8);

    const user = await prisma.users.create({
      data: {
        name,
        email,
        tel,
        password: hashedPassword
      }
    });

    request.user = {
      id: user.id,
    };

    return next();
  }
}