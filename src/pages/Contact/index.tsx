import { useState, type FormEvent } from 'react'
import { PERSON } from '../../data/resume'
import './style.css'

// ─────────────────────────────────────────────────────────────
// EMAIL via Formspree (free, no backend needed)
//
// Setup (takes ~2 min):
//   1. Create a free account at https://formspree.io
//   2. Click "New Form" → point it at chitransh.joshi99@gmail.com
//   3. Copy the form ID (e.g. "xpzgkwqr") and paste it below
//   4. Formspree sends you the email directly — no mail client opens
//
// Until configured, the Email button falls back to mailto:.
// ─────────────────────────────────────────────────────────────
const FORMSPREE_ID = ''   // ← paste your Formspree form ID here

// WhatsApp number (digits only, with country code)
const WA_NUMBER = '918126196827'

// ─────────────────────────────────────────────────────────────

interface FormState {
  name:    string
  email:   string
  subject: string
  message: string
}

type SendMode   = 'whatsapp' | 'email'
type FormStatus = 'idle' | 'sending' | 'sent' | 'error'

const INITIAL: FormState = { name: '', email: '', subject: '', message: '' }

export default function Contact() {
  const [form, setForm]     = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errors, setErrors] = useState<Partial<FormState>>({})

  const validate = (mode: SendMode): boolean => {
    const errs: Partial<FormState> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (mode === 'email') {
      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Valid email required'
    }
    if (!form.subject.trim()) errs.subject = 'Subject is required'
    if (form.message.trim().length < 10) errs.message = 'Message too short'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name as keyof FormState]) {
      setErrors(errs => ({ ...errs, [name]: undefined }))
    }
  }

  // ── WhatsApp — opens wa.me with a pre-filled message ────────
  const sendWhatsApp = (e: FormEvent) => {
    e.preventDefault()
    if (!validate('whatsapp')) return

    const text = [
      `*New message from your portfolio*`,
      ``,
      `*Name:* ${form.name}`,
      form.email ? `*Email:* ${form.email}` : null,
      `*Subject:* ${form.subject}`,
      ``,
      form.message,
    ].filter(l => l !== null).join('\n')

    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    )
    setStatus('sent')
    setTimeout(() => { setForm(INITIAL); setStatus('idle') }, 3000)
  }

  // ── Email — Formspree fetch OR mailto fallback ───────────────
  const sendEmail = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate('email')) return
    setStatus('sending')

    if (FORMSPREE_ID) {
      // Formspree: sends directly to your inbox, no mail client
      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name:    form.name,
            email:   form.email,
            subject: form.subject,
            message: form.message,
          }),
        })
        if (res.ok) {
          setStatus('sent')
          setTimeout(() => { setForm(INITIAL); setStatus('idle') }, 3500)
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    } else {
      // Fallback: mailto (opens mail client — configure Formspree to remove this)
      await new Promise(r => setTimeout(r, 600))
      const body = `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
      window.location.href =
        `mailto:${PERSON.email}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`
      setStatus('sent')
      setTimeout(() => { setForm(INITIAL); setStatus('idle') }, 3000)
    }
  }

  const isSending = status === 'sending'

  return (
    <main className="contact-page">
      <div className="container contact-inner">

        {/* ── Left — info panel ──────────────────────────── */}
        <aside className="contact-info">
          <p className="contact-info__label pixel-text">// SEND_MESSAGE</p>
          <h1 className="contact-info__heading pixel-text">
            Let's build something fast.
          </h1>
          <p className="contact-info__body">
            Open to senior frontend / full-stack roles, contract work, and interesting
            collaborations. Drop a message and I'll get back within 24 hours.
          </p>

          <ul className="contact-links" role="list">
            <ContactLink
              icon="@"
              label="Email"
              href={`mailto:${PERSON.email}`}
              text={PERSON.email}
            />
            <ContactLink
              icon="☎"
              label="Phone / WhatsApp"
              href={`https://wa.me/${WA_NUMBER}`}
              text={PERSON.phone}
              external
            />
            <ContactLink
              icon="◈"
              label="GitHub"
              href={PERSON.github}
              text="github.com/chitranshjoshi99"
              external
            />
            <ContactLink
              icon="▦"
              label="Location"
              href="#"
              text={PERSON.location}
            />
          </ul>

          {/* Terminal decoration */}
          <div className="contact-terminal" aria-hidden="true">
            <div className="contact-terminal__bar">
              <span /><span /><span />
            </div>
            <div className="contact-terminal__body">
              <p className="pixel-text contact-terminal__line">
                <span className="contact-terminal__prompt">$ </span>whoami
              </p>
              <p className="pixel-text contact-terminal__output">chitransh-joshi</p>
              <p className="pixel-text contact-terminal__line">
                <span className="contact-terminal__prompt">$ </span>cat status.txt
              </p>
              <p className="pixel-text contact-terminal__output contact-terminal__output--green">
                AVAILABLE_FOR_WORK
              </p>
              <p className="pixel-text contact-terminal__line">
                <span className="contact-terminal__prompt">$ </span>
                <span className="contact-terminal__cursor">▮</span>
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right — form ────────────────────────────────── */}
        <div className="contact-form-wrap">
          {status === 'sent' ? (
            <SuccessState onReset={() => { setForm(INITIAL); setStatus('idle') }} />
          ) : (
            <form className="contact-form" noValidate>
              <p className="contact-form__title pixel-text">// NEW_MESSAGE</p>

              <div className="form-row">
                <Field
                  label="NAME"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  error={errors.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
                <Field
                  label="EMAIL"
                  name="email"
                  type="email"
                  placeholder="you@example.com (for email reply)"
                  value={form.email}
                  error={errors.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>

              <Field
                label="SUBJECT"
                name="subject"
                type="text"
                placeholder="What's this about?"
                value={form.subject}
                error={errors.subject}
                onChange={handleChange}
              />

              <div className="form-field">
                <label className="form-label pixel-text" htmlFor="message">MESSAGE</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  className={`form-textarea ${errors.message ? 'form-input--error' : ''}`}
                  placeholder="Tell me about the project, role, or just say hi..."
                  value={form.message}
                  onChange={handleChange}
                />
                {errors.message && (
                  <p className="form-error pixel-text">{errors.message}</p>
                )}
              </div>

              {/* Two send actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--whatsapp pixel-text"
                  onClick={sendWhatsApp}
                  disabled={isSending}
                  title="Opens WhatsApp — no email app needed"
                >
                  <span className="form-actions__icon" aria-hidden="true">◉</span>
                  WHATSAPP
                </button>

                <button
                  type="button"
                  className={`btn btn--email pixel-text ${isSending ? 'btn--loading' : ''}`}
                  onClick={sendEmail}
                  disabled={isSending}
                  title={FORMSPREE_ID ? 'Sends email directly' : 'Opens your mail app'}
                >
                  <span className="form-actions__icon" aria-hidden="true">
                    {isSending ? '◌' : '◫'}
                  </span>
                  {isSending ? 'SENDING...' : (FORMSPREE_ID ? 'SEND EMAIL' : 'EMAIL')}
                </button>

                {status === 'error' && (
                  <p className="form-send-error pixel-text">
                    ✕ Send failed — try WhatsApp instead
                  </p>
                )}
              </div>

              {/* Hint about Formspree if not configured */}
              {!FORMSPREE_ID && (
                <p className="form-hint pixel-text">
                  EMAIL opens your mail client. Add a Formspree ID to send directly.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────

interface ContactLinkProps {
  icon:     string
  label:    string
  href:     string
  text:     string
  external?: boolean
}

function ContactLink({ icon, label, href, text, external }: ContactLinkProps) {
  return (
    <li className="contact-link">
      <span className="contact-link__icon pixel-text" aria-hidden="true">{icon}</span>
      <div>
        <p className="contact-link__label pixel-text">{label}</p>
        <a
          href={href}
          className="contact-link__value"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {text}
        </a>
      </div>
    </li>
  )
}

interface FieldProps {
  label:        string
  name:         string
  type:         string
  placeholder:  string
  value:        string
  error?:       string
  onChange:     (e: React.ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
}

function Field({ label, name, type, placeholder, value, error, onChange, autoComplete }: FieldProps) {
  return (
    <div className="form-field">
      <label className="form-label pixel-text" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={`form-input ${error ? 'form-input--error' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && <p className="form-error pixel-text" id={`${name}-error`}>{error}</p>}
    </div>
  )
}

function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div className="contact-success">
      <div className="contact-success__icon pixel-text" aria-hidden="true">✓</div>
      <p className="contact-success__title pixel-text">MESSAGE_SENT</p>
      <p className="contact-success__sub">
        Message dispatched. I'll get back to you within 24 hours.
      </p>
      <button className="btn btn--outline pixel-text" onClick={onReset}>
        ↩ SEND ANOTHER
      </button>
    </div>
  )
}
