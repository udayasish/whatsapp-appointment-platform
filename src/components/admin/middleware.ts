// src/components/admin/middleware.ts
// Re-export shared auth middlewares from global middlewares
export { requireAdminAuth, requireSuperAdmin } from "../../middlewares/auth.js";
