import { useState } from 'react'
import type { User } from '../types'
import { bindPhone } from '../api'
import SmsCodeField from './SmsCodeField'
import './PhoneBindModal.css'

interface PhoneBindModalProps {
  open: boolean
  user: User | null
  onBound: (user: User) => void
  /** 短信通道是否已配置；未配置时无需验证码 */
  smsEnabled?: boolean
}

/** 未绑定手机号的账号登录后强制补绑（短信通道可用时需验证码） */
export default function PhoneBindModal({ open, user, onBound, smsEnabled }: PhoneBindModalProps) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open || !user) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\+?[\d\s-]{6,20}$/.test(phone.trim())) {
      setError('请填写有效的手机号')
      return
    }
    if (smsEnabled && !/^\d{6}$/.test(code)) {
      setError('请填写手机收到的 6 位短信验证码')
      return
    }
    try {
      setBusy(true)
      setError('')
      const { user: updated } = await bindPhone(phone.trim(), code)
      onBound(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay phone-bind-overlay">
      <div className="modal phone-bind-modal">
        <div className="modal-head">
          <h3>绑定手机号</h3>
        </div>
        <p className="phone-bind-desc">
          论坛要求所有账号实名绑定手机号。手机号仅用于违规行为精准溯源，不会公开展示，仅频道主与板块管理员可查看。
        </p>
        <form onSubmit={submit}>
          <label className="field-label">
            手机号
            <input
              type="tel"
              className="field-input"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              autoFocus
              required
            />
          </label>
          {smsEnabled && (
            <SmsCodeField
              phone={phone}
              purpose="bind"
              value={code}
              onChange={setCode}
              onError={setError}
            />
          )}
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '绑定中…' : '绑定并继续'}
          </button>
        </form>
      </div>
    </div>
  )
}
