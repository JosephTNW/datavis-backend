import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const authRouter = new Hono();
const client = new PrismaClient();

authRouter.post("/login", async (c) => {
  const body = await c.req.json();

  try {
    const user = await client.users.findFirstOrThrow({
      where: {
        email: body.email,
      },
    });

    const valid = await bcrypt.compare(body.password, user.password);

    if (valid) {
      const session = await client.sessions.create({
        data: {
          userId: user.id,
        },
      });

      return c.json({
        success: true,
        message: "Login successful",
        token: session.id,
      });
    } else {
      return c.json({ success: false, message: "Invalid credentials" });
    }
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ success: false, message: "No matching user found" });
    }
    return c.json({ success: false, message: "Serverside Error", error });
  }
});

authRouter.post("/register", async (c) => {
  const body = await c.req.json();
  try {
    const user = await client.users.create({
      data: {
        name: body.name,
        email: body.email,
        password: await bcrypt.hash(body.password, 10),
      },
    });

    const session = await client.sessions.create({
      data: {
        userId: user.id,
      },
    });

    return c.json({
      success: true,
      message: "Register successful",
      token: session.id,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return c.json({ success: false, message: "Email already in use" });
    }
    return c.json({ success: false, message: "Serverside Error", error });
  }
});

export default authRouter;
