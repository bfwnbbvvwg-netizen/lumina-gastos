import { useState } from 'react';
import { CircleDollarSign, Loader2 } from 'lucide-react';
import { signIn, signUp } from '../services/auth';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMessageType('success');
        setMessage('Revisa tu correo para confirmar la cuenta.');
      }
    } catch (error) {
      setMessageType('error');
      setMessage(error.message || 'Ocurrio un error en la autenticacion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-8 text-ink sm:px-6">
      <section className="w-full max-w-md rounded-lg border border-white/80 bg-white p-6 shadow-soft sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-md">
            <CircleDollarSign aria-hidden="true" size={28} />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-normal">Lumina</h1>
          <p className="mt-2 text-sm font-medium text-ink/62">
            {isLogin ? 'Bienvenido de vuelta a tus finanzas' : 'Comienza a ordenar tus gastos'}
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Correo electronico
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-lg border border-paper bg-paper px-4 text-ink outline-none transition focus:border-sage focus:bg-white"
              placeholder="tu@correo.com"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-ink/65">
            Contrasena
            <input
              type="password"
              required
              minLength="6"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-lg border border-paper bg-paper px-4 text-ink outline-none transition focus:border-sage focus:bg-white"
              placeholder="Minimo 6 caracteres"
            />
          </label>

          {message && (
            <div
              className={`rounded-lg border p-3 text-center text-sm font-medium ${
                messageType === 'success'
                  ? 'border-sage/30 bg-sage/12 text-moss'
                  : 'border-coral/20 bg-coral/10 text-coral'
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 aria-hidden="true" className="animate-spin" size={20} />}
            {!loading && (isLogin ? 'Iniciar sesion' : 'Crear cuenta')}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin((current) => !current);
              setMessage('');
            }}
            className="text-sm font-semibold text-moss transition hover:text-ink"
          >
            {isLogin ? 'No tienes cuenta? Registrate aqui' : 'Ya tienes cuenta? Inicia sesion'}
          </button>
        </div>
      </section>
    </main>
  );
}
