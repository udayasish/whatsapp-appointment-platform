import { Router } from "express";
import { receiveWebhookHandler, verifyWebhookHandler } from "./controller.js";
import { verifyWhatsappSignature } from "./verify-signature.js";

export const whatsappRouter = Router();

whatsappRouter.get("/webhook", verifyWebhookHandler);
whatsappRouter.post("/webhook", verifyWhatsappSignature, receiveWebhookHandler);
