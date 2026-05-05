/**
 * Joi Validation Schemas for Request Validation
 * Ensures all incoming data conforms to expected structure and types
 */

import Joi from "joi";

/**
 * Custom validation error response
 */
export const createValidationError = (details) => {
  const errors = {};
  details.forEach((detail) => {
    errors[detail.path.join(".")] = detail.message;
  });
  return errors;
};

/**
 * Validate using a Joi schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} { value, error }
 */
export const validateData = (data, schema) => {
  return schema.validate(data, { 
    stripUnknown: true,
    abortEarly: false,
    convert: true
  });
};

// ============ Authentication Schemas ============

export const registerSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.empty": "Name is required",
      "string.max": "Name must not exceed 100 characters"
    }),

  email: Joi.string()
    .required()
    .email()
    .lowercase()
    .trim()
    .max(255)
    .messages({
      "string.email": "Invalid email format"
    }),

  password: Joi.string()
    .required()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base": "Password must contain uppercase, lowercase, number, and special character"
    })
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .required()
    .email()
    .lowercase()
    .trim()
    .messages({
      "string.email": "Invalid email format"
    }),

  password: Joi.string()
    .required()
    .messages({
      "string.empty": "Password is required"
    })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      "string.empty": "Refresh token is required"
    })
});

// ============ Conversation Schemas ============

export const createGroupSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.empty": "Group name is required",
      "string.max": "Group name must not exceed 100 characters"
    }),

  memberIds: Joi.array()
    .items(
      Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid member ID format"
        })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one member is required"
    }),

  groupIcon: Joi.string()
    .max(500)
    .allow("")
    .trim()
});

export const updateGroupSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .trim(),

  groupIcon: Joi.string()
    .optional()
    .max(500)
    .trim()
});

export const addGroupMemberSchema = Joi.object({
  userId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid user ID format"
    })
});

export const startConversationSchema = Joi.object({
  participantId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid participant ID format"
    })
});

export const updatePreferencesSchema = Joi.object({
  muted: Joi.boolean().optional(),
  favorite: Joi.boolean().optional(),
  wallpaper: Joi.string().optional().max(50).trim()
});

// ============ Message Schemas ============

export const sendMessageSchema = Joi.object({
  conversationId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid conversation ID format"
    }),

  content: Joi.string()
    .max(10000)
    .allow("")
    .trim(),

  type: Joi.string()
    .valid("text", "image", "file")
    .default("text"),

  fileUrl: Joi.string()
    .allow("")
    .max(1000),

  fileName: Joi.string()
    .allow("")
    .max(255),

  clientId: Joi.string()
    .optional()
    .max(100),

  replyTo: Joi.string()
    .optional()
    .regex(/^[0-9a-fA-F]{24}$/)
});

export const searchMessagesSchema = Joi.object({
  q: Joi.string()
    .optional()
    .max(100)
    .trim(),

  sender: Joi.string()
    .optional()
    .regex(/^[0-9a-fA-F]{24}$/),

  type: Joi.string()
    .optional()
    .valid("text", "image", "file", "all"),

  pinned: Joi.string()
    .optional()
    .valid("true", "false"),

  hasFile: Joi.string()
    .optional()
    .valid("true", "false"),

  from: Joi.string().optional().isoDate(),
  to: Joi.string().optional().isoDate()
});

export const updateMessageSchema = Joi.object({
  content: Joi.string()
    .max(10000)
    .trim()
    .required()
});

export const reactToMessageSchema = Joi.object({
  emoji: Joi.string()
    .required()
    .max(10)
});

export const pinMessageSchema = Joi.object({});

// ============ User Schemas ============

export const searchUsersSchema = Joi.object({
  q: Joi.string()
    .optional()
    .max(100)
    .trim()
});

export const updateUserSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .trim(),

  bio: Joi.string()
    .optional()
    .max(500)
    .trim(),

  profilePic: Joi.string()
    .optional()
    .max(1000)
});

export const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      "string.empty": "Current password is required"
    }),

  newPassword: Joi.string()
    .required()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      "string.min": "New password must be at least 8 characters",
      "string.pattern.base": "Password must contain uppercase, lowercase, number, and special character"
    })
});

// ============ ObjectId Validation ============

export const objectIdSchema = Joi.object({
  id: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid ID format"
    })
});

export const conversationIdParamSchema = Joi.object({
  conversationId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid conversation ID format"
    })
});

export const removeGroupMemberParamSchema = Joi.object({
  id: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid group ID format"
    }),
  userId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.pattern.base": "Invalid user ID format"
    })
});
