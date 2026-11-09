import { useEffect, useRef, useState } from 'react'
import { sendSmsCode, type SmsPurpose } from '../api'
import './SmsCodeField.css'

interface SmsCodeFieldProps {
  /** 接收验证码的手机号；换绑时由服务端决定发往原绑定号码，可传空 */
  phone: string
  purpose: SmsPurpose
  value: string
  onChange: (value: string) => void
  onError?: (message: string) => void
}

/** 6 位短信验证码输入 + 获取验证码按钮（含 60 秒倒计时） */
export default function SmsCodeField({ phone, purpose, value, onChange, onError }: SmsCodeFieldProps) {
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [hint, setHint] = useState('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
  }, [])

  const startCountdown = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    setCountdown(60)
    timerRef.current = window.setInterval(() => {
      setCountdown(v => {
        if (v <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          return 0
        }
        return v - 1
      })
    }, 1000)
  }

  const send = async () => {
    if (sending || countdown > 0) return
    if (purpose !== 'rebind' && !/^\+?[\d\s-]{6,20}$/.test(phone.trim())) {
      onError?.(purpose === 'bind' ? '请先填写要绑定的手机号' : '请先填写手机号')
      return
    }
    try {
      setSending(true)
      setHint('')
      onError?.('')
      const res = await sendSmsCode(phone.trim(), purpose)
      setHint(`验证码已发送至 ${res.phone}，10 分钟内有效`)
      startCountdown()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : '验证码发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <label className="field-label">
        短信验证码
        <div className="sms-code-row">
          <input
            className="field-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6 位数字验证码"
            value={value}
            onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          <button
            type="button"
            className="sms-send-btn"
            onClick={send}
            disabled={sending || countdown > 0}
          >
            {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
          </button>
        </div>
      </label>
      {hint && <p className="sms-hint">{hint}</p>}
    </>
  )
}
