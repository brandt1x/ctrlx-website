# EmailJS Setup Guide

This guide will walk you through setting up EmailJS so that contact form submissions are sent to **cntrlx4@gmail.com**.

## Step 1: Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click **"Sign Up"** (top right)
3. Sign up with your email (you can use cntrlx4@gmail.com or any email)
4. Verify your email address

## Step 2: Create an Email Service

1. After logging in, go to **"Email Services"** in the left sidebar
2. Click **"Add New Service"**
3. Choose an email provider:
   - **Gmail** (recommended if you use Gmail)
   - **Outlook** (if you use Outlook)
   - **Custom SMTP** (for any other email provider)
4. Follow the setup instructions for your chosen provider
5. Once connected, note your **Service ID** (it will look like `service_xxxxxxx`)

### For Gmail Users:
- You'll need to enable "Less secure app access" or use an App Password
- Or use OAuth2 authentication (more secure)

## Step 3: Create an Email Template

1. Go to **"Email Templates"** in the left sidebar
2. Click **"Create New Template"**
3. Use these settings:

   **Template Name:** `Contact Form`
   
   **Subject:** `New Contact Request from {{from_name}}`
   
   **Content (HTML):**
   ```html
   <h2>New Contact Request</h2>
   <p><strong>From:</strong> {{from_name}}</p>
   <p><strong>Email:</strong> {{from_email}}</p>
   <p><strong>Message:</strong></p>
   <p>{{message}}</p>
   <hr>
   <p><small>Sent from your website contact form</small></p>
   ```

4. **To Email:** `cntrlx4@gmail.com`
5. **From Name:** `{{from_name}}`
6. **Reply To:** `{{from_email}}`
7. Click **"Save"**
8. Note your **Template ID** (it will look like `template_xxxxxxx`)

## Step 4: Get Your Public Key

1. Go to **"Account"** → **"General"** in the left sidebar
2. Scroll down to **"API Keys"**
3. Copy your **Public Key** (it will look like `xxxxxxxxxxxxxxxxxxxx`)

## Step 5: Update Your Code

Open `script.js` and find the contact form section (around line 374). Update these three values:

```javascript
// Replace 'YOUR_PUBLIC_KEY' with your EmailJS Public Key
emailjs.init('YOUR_PUBLIC_KEY');

// Replace 'YOUR_SERVICE_ID' with your EmailJS Service ID
const response = await emailjs.send(
    'YOUR_SERVICE_ID',      // ← Replace this
    'YOUR_TEMPLATE_ID',     // ← Replace this
    {
        to_email: 'cntrlx4@gmail.com',
        from_name: name,
        from_email: email,
        message: details,
        reply_to: email,
    }
);
```

### Example:
If your Public Key is `abc123xyz`, Service ID is `service_gmail123`, and Template ID is `template_contact456`, it would look like:

```javascript
emailjs.init('abc123xyz');

const response = await emailjs.send(
    'service_gmail123',
    'template_contact456',
    {
        to_email: 'cntrlx4@gmail.com',
        from_name: name,
        from_email: email,
        message: details,
        reply_to: email,
    }
);
```

## Step 6: Test the Form

1. Open `contact.html` in your browser
2. Fill out the contact form with test data
3. Click **"Send Request"**
4. Check your email inbox at **cntrlx4@gmail.com**
5. You should receive the email within a few seconds

## Troubleshooting

### Form shows "EmailJS not loaded" error
- Make sure the EmailJS script is loaded in `contact.html` before `script.js`
- Check your browser console for any script loading errors

### "Failed to send request" error
- Verify your Public Key, Service ID, and Template ID are correct
- Check that your email service is connected and active
- Make sure the template variables match: `{{from_name}}`, `{{from_email}}`, `{{message}}`

### Email not received
- Check your spam/junk folder
- Verify the "To Email" in your template is set to `cntrlx4@gmail.com`
- Check EmailJS dashboard → "Logs" to see if emails are being sent

### Template variables not working
- Make sure variable names in the template match exactly:
  - `{{from_name}}` (not `{{name}}`)
  - `{{from_email}}` (not `{{email}}`)
  - `{{message}}` (not `{{details}}`)

## Free Tier Limits

EmailJS free tier includes:
- **200 emails per month**
- Basic email templates
- Standard support

If you need more, consider upgrading to a paid plan.

## Security Notes

- Your Public Key is safe to expose in frontend code (it's designed for that)
- Never share your Private Key (if you have one)
- The Service ID and Template ID are also safe to use in frontend code

## Need Help?

- EmailJS Documentation: [https://www.emailjs.com/docs/](https://www.emailjs.com/docs/)
- EmailJS Support: Check their help center or contact support

---

**Quick Checklist:**
- [ ] Created EmailJS account
- [ ] Created email service and noted Service ID
- [ ] Created email template and noted Template ID
- [ ] Got Public Key from Account settings
- [ ] Updated script.js with all three values
- [ ] Tested the form and received email

Once all steps are complete, your contact form will automatically send emails to cntrlx4@gmail.com! 🎉
