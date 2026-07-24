// api/send-bulk-sms.js
//
// Vercel Serverless Function — no separate deploy step needed, it ships
// automatically with your existing `vercel` deploy since it lives in /api.
//
// Set these in Vercel: Project Settings → Environment Variables
//   TWILIO_SID   = your Twilio Account SID
//   TWILIO_TOKEN = your Twilio Auth Token
//   TWILIO_FROM  = your Twilio SMS-enabled number, e.g. +1xxxxxxxxxx
// Redeploy after adding them so the function picks them up.
 
// Lebanon numbers only: country code 961, followed by either
//  - an 8-digit local number (landline / most mobiles), or
//  - a 7-digit mobile number starting with 3 (older format)
// i.e. total digit length after "961" is 7 or 8.
function isLebanonNumber(digitsOnly) {
  if (!digitsOnly.startsWith('961')) return false
  const national = digitsOnly.slice(3)
  if (national.length === 8) return true
  if (national.length === 7 && national.startsWith('3')) return true
  return false
}
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
 
  const { message, numbers } = req.body || {}
 
  if (!message || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'message and numbers[] are required' })
  }
 
  // Server-side safety net: even if the frontend already filtered, never let
  // a non-Lebanon number reach Twilio from this endpoint.
  const lebanonNumbers = numbers.filter(n => isLebanonNumber(String(n).replace(/\D/g, '')))
  const skipped = numbers.length - lebanonNumbers.length
 
  if (lebanonNumbers.length === 0) {
    return res.status(400).json({ error: 'No valid Lebanon numbers in the request', skipped })
  }
 
  const accountSid = process.env.TWILIO_SID
  const authToken  = process.env.TWILIO_TOKEN
  const fromNumber = process.env.TWILIO_FROM
 
  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio credentials not configured on the server' })
  }
 
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
 
  const results = await Promise.allSettled(
    lebanonNumbers.map((number) =>
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: number.startsWith('+') ? number : `+${number}`,
          From: fromNumber,
          Body: message,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(`Twilio error for ${number}: ${r.status}`)
        return r.json()
      })
    )
  )
 
  const sent   = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
 
  return res.status(200).json({ sent, failed, skipped, total: numbers.length })
}
 