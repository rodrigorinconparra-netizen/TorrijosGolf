import { z } from "zod";

export const teacherProfileSchema = z.object({
  title: z.string().trim().max(80).optional(),
  specialties: z.string().trim().max(300).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  bio: z.string().trim().max(1500).optional(),
});

/** Lee y valida los campos del perfil público de profesor de un FormData. */
export function parseTeacherProfile(formData: FormData) {
  return teacherProfileSchema.safeParse({
    title: formData.get("title") || undefined,
    specialties: formData.get("specialties") || undefined,
    experienceYears: formData.get("experienceYears") || undefined,
    bio: formData.get("bio") || undefined,
  });
}
