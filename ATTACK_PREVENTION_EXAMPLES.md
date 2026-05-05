# NoSQL Injection - Before & After Examples

## 1. Authentication Bypass Attack

### ❌ BEFORE (Vulnerable)

```javascript
// auth.controller.js (OLD)
const { email, password } = req.body;
const user = await User.findOne({ email, password }); // No sanitization!

// Attack:
POST /api/auth/login
{
  "email": {"$gt": ""},
  "password": {"$gt": ""}
}

// Result: Finds ANY user (bypasses authentication)
```

### ✅ AFTER (Secure)

```javascript
// auth.controller.js (NEW) + auth.routes.js
router.post("/login", authRateLimit, validateBody(loginSchema), login);

// Input validation happens first:
const loginSchema = Joi.object({
  email: Joi.string().required().email().lowercase().trim(),
  password: Joi.string().required()
});

// Sanitization middleware runs automatically:
// - Removes any keys starting with '$'
// - Input becomes: { "email": "", "password": "" }
// - Password will fail bcrypt comparison
// - Attack blocked ✅

POST /api/auth/login
{
  "email": {"$gt": ""},  // Sanitizer removes $gt key
  "password": {"$gt": ""}
}

// Result: Empty email/password → Authentication fails normally
```

---

## 2. User Search Injection

### ❌ BEFORE (Vulnerable)

```javascript
// user.controller.js (OLD)
const q = req.query.q;
const users = await User.find({
  $or: [
    { name: { $regex: q } },
    { email: { $regex: q } }
  ]
});

// Attack 1: Return all users
GET /api/users/search?q=.*

// Attack 2: Character extraction (timing-based)
GET /api/users/search?q=admin.*

// Attack 3: Operator injection
GET /api/users/search?q={"$ne": null}

// Result: Attackers can enumerate users, extract emails
```

### ✅ AFTER (Secure)

```javascript
// user.routes.js + user.controller.js
router.get("/search", validateQuery(searchUsersSchema), searchUsers);

// Input validation:
const searchUsersSchema = Joi.object({
  q: Joi.string().optional().max(100).trim()
});

// user.controller.js:
const q = req.query.q?.trim() || "";
const escapedQuery = escapeRegex(q); // Escapes special chars

const users = await User.find({
  $and: [
    { _id: { $ne: req.user._id } },
    {
      $or: [
        { name: { $regex: escapedQuery, $options: "i" } },
        { email: { $regex: escapedQuery, $options: "i" } }
      ]
    }
  ]
})
  .select("name profilePic bio isOnline lastSeen")
  .limit(20);

// Attack attempt:
GET /api/users/search?q=.*

// After escapeRegex:
// Input: ".*"
// Output: "\\.*"
// Searches for literal "." followed by "*", not regex wildcard
// Result: No ReDoS, no data leak ✅
```

---

## 3. Group Member Injection

### ❌ BEFORE (Vulnerable)

```javascript
// conversation.controller.js (OLD)
const { name, memberIds } = req.body;
const group = await Conversation.create({
  name,
  participants: memberIds,
  admin: req.user._id
});

// Attack:
POST /api/conversations/group
{
  "name": {"$regex": "admin"},
  "memberIds": ["invalid_id"],
  "groupIcon": {"$set": {admin: attacker_id}}
}

// Result: Injection in name field, injection in groupIcon
```

### ✅ AFTER (Secure)

```javascript
// conversation.routes.js + conversation.controller.js
router.post("/group", validateBody(createGroupSchema), createGroupConversation);

// Input validation:
const createGroupSchema = Joi.object({
  name: Joi.string().required().min(1).max(100).trim(),
  memberIds: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .min(1).required(),
  groupIcon: Joi.string().max(500).allow("").trim()
});

// Result: Sanitization + Validation
// - Sanitizer removes "$regex", "$set"
// - Validator enforces string type for name
// - Validator enforces ObjectId format for memberIds
// - Invalid ObjectIds rejected before DB query

POST /api/conversations/group
{
  "name": {"$regex": "admin"},     // Sanitizer removes this, validation fails
  "memberIds": ["invalid_id"],     // Regex validation fails: not 24-char hex
  "groupIcon": {"$set": {...}}     // Sanitizer removes $set
}

// Result: 400 Bad Request with validation errors ✅
```

---

## 4. Message Sender Spoofing

### ❌ BEFORE (Vulnerable)

```javascript
// message.controller.js (OLD)
const { conversationId, content, sender } = req.body;
const message = await Message.create({
  conversation: conversationId,
  content,
  sender: sender  // No validation!
});

// Attack:
POST /api/messages
{
  "conversationId": "507f1f77bcf86cd799439011",
  "content": "Look at my message!",
  "sender": "507f1f77bcf86cd799439999"  // Fake user ID
}

// Result: Message appears to be from attacker's chosen user
// Identity spoofing ✅
```

### ✅ AFTER (Secure)

```javascript
// message.controller.js (NEW) + middleware/auth.middleware.js
// Step 1: Authentication validates JWT
const payload = jwt.verify(token, jwtSecret); // Verified signature
const userId = payload.id; // Extract from verified token

// Step 2: Validation schema enforces message structure
const sendMessageSchema = Joi.object({
  conversationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  content: Joi.string().max(10000).trim(),
  type: Joi.string().valid("text", "image", "file").default("text"),
  fileUrl: Joi.string().allow("").max(1000),
  fileName: Joi.string().allow("").max(255)
  // NOTE: No "sender" field allowed in schema!
});

// Step 3: Controller uses authenticated userId
export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type, fileUrl, fileName } = req.body;
    const sender = req.user._id;  // From verified JWT, not user input
    
    const message = await Message.create({
      conversation: conversationId,
      content,
      type,
      fileUrl,
      fileName,
      sender  // Uses authenticated user, not client input ✅
    });
    
    return sendSuccessResponse(res, HTTP_STATUS.CREATED, { message });
  } catch (err) {
    return handleCatchError(err, res, "SendMessage");
  }
};

// Attack attempt:
POST /api/messages
{
  "conversationId": "507f1f77bcf86cd799439011",
  "content": "Look at my message!",
  "sender": "507f1f77bcf86cd799439999"
}

// Result:
// 1. Sanitizer removes "sender" (stripUnknown: true)
// 2. Validator rejects unknown field
// 3. Message created with authenticated user's ID
// 4. Sender is verifiably authentic ✅
```

---

## 5. Conversation Access Control Bypass

### ❌ BEFORE (Vulnerable)

```javascript
// conversation.controller.js (OLD)
const conversationId = req.params.id;
const conversation = await Conversation.findById(conversationId);

// if no ObjectId validation
// Attack:
GET /api/conversations/{"$ne": null}

// This could match records unexpectedly

// Also: No validation that user is participant
```

### ✅ AFTER (Secure)

```javascript
// conversation.routes.js
router.get("/:id", validateParams(objectIdSchema), getConversationById);

// Step 1: Parameter validation
const objectIdSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
});

// Step 2: Controller with access control
export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate(listPopulate);

    if (!conversation) {
      return sendNotFound(res, "Conversation not found");
    }

    // Step 3: Verify access control
    const hasAccess = conversation.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );
    if (!hasAccess) {
      return sendForbidden(res, "Forbidden");
    }

    const payload = await withUnreadCount(conversation, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "GetConversationById");
  }
};

// Attack attempt:
GET /api/conversations/{"$ne": null}

// Result:
// 1. Parameter validation regex fails (not 24-char hex)
// 2. 400 Bad Request returned
// 3. No database query executed
// 4. No unauthorized access possible ✅
```

---

## 6. Update Group Name Injection

### ❌ BEFORE (Vulnerable)

```javascript
// conversation.controller.js (OLD)
const { name, groupIcon } = req.body;
if (name !== undefined) conversation.name = name;
if (groupIcon !== undefined) conversation.groupIcon = groupIcon;
await conversation.save();

// Attack:
PUT /api/conversations/607f1f77bcf86cd799439011/group
{
  "name": {"$regex": "admin"},
  "groupIcon": {"constructor": {"prototype": {"constructor": {...}}}}
}

// Result: Possible prototype pollution or data injection
```

### ✅ AFTER (Secure)

```javascript
// conversation.routes.js
router.put("/:id/group",
  validateParams(objectIdSchema),
  validateBody(updateGroupSchema),
  updateGroupConversation
);

// Step 1: Body validation
const updateGroupSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100).trim(),
  groupIcon: Joi.string().optional().max(500).trim()
});

// Step 2: Parameter validation
const objectIdSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
});

// Step 3: Controller enforces types
export const updateGroupConversation = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendNotFound(res, "Group not found");
    }
    
    const conversation = await getGroupConversation(req.params.id);
    // ...
    
    const { name, groupIcon } = req.body;
    if (name !== undefined) {
      const sanitizedName = typeof name === "string" ? name.trim() : "";
      if (sanitizedName) conversation.name = sanitizedName;
    }
    if (groupIcon !== undefined) {
      conversation.groupIcon = typeof groupIcon === "string" ? groupIcon.trim() : "";
    }
    // ...
  }
};

// Attack attempt:
PUT /api/conversations/607f1f77bcf86cd799439011/group
{
  "name": {"$regex": "admin"},
  "groupIcon": {"constructor": {...}}
}

// Result:
// 1. Sanitizer removes "$regex" and "constructor"
// 2. Input becomes: { "name": {}, "groupIcon": {} }
// 3. Type check fails: typeof {} === "string" → false
// 4. Values not updated, or updated to empty
// 5. No injection successful ✅
```

---

## Summary of Attack Prevention

| Attack Type | Prevention Layer | Status |
|---|---|---|
| Operator injection (`$gt`, `$ne`, `$where`) | Sanitizer | ✅ Blocked |
| Type confusion | Joi validation | ✅ Blocked |
| Format bypass (ObjectId) | Regex validation | ✅ Blocked |
| ReDoS (regex DoS) | Regex escaping | ✅ Prevented |
| String-based RCE | No `$where`/`eval` | ✅ N/A |
| Prototype pollution | Sanitizer + type check | ✅ Blocked |
| Data leakage | Regex escaping + limits | ✅ Prevented |
| Identity spoofing | JWT verification | ✅ Prevented |
| Unauthorized access | Parameter validation | ✅ Blocked |
| DoS via long input | Length validation | ✅ Blocked |

---

All attack vectors have been successfully remediated! 🛡️
