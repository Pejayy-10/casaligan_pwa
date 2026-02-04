export default function TestPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>✅ Vercel Deployment Works!</h1>
      <p>If you can see this page, the deployment is successful.</p>
      <p>Time: {new Date().toISOString()}</p>
      <a href="/auth" style={{ color: 'blue' }}>Go to Login</a>
    </div>
  )
}
