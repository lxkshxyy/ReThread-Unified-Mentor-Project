import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Camera, Search, MessagesSquare, PackageCheck, Scale, MapPin, Leaf, Droplets, Recycle, ShieldCheck } from 'lucide-react';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import ItemCard, { ItemGridSkeleton } from '@/components/ItemCard';
import { Section } from '@/components/ui';
import { fmtNum } from '@/lib/utils';
import { photoUrl } from '@shared/photos.js';

const STEPS = [
  { icon: Camera, title: 'List what you don’t wear', text: 'Snap a few photos, add brand, size and condition. Our calculator suggests a fair swap value instantly.' },
  { icon: Search, title: 'Find something you love', text: 'Filter by category, size and distance. We highlight fair matches from people near you.' },
  { icon: MessagesSquare, title: 'Request & negotiate', text: 'Offer one or more items, counter-offer and agree on terms in chat — no money involved.' },
  { icon: PackageCheck, title: 'Meet up or courier', text: 'Exchange at a public spot nearby or ship with tracking. Both confirm, both rate.' },
];

const CATS = [
  { label: 'Ethnic wear', q: 'category=kurta,saree,lehenga,ethnic_set,dupatta', img: photoUrl('saree-pink-orange', 600) },
  { label: 'Jackets & coats', q: 'category=jacket,coat,blazer', img: photoUrl('leather-jacket-brown', 600) },
  { label: 'Dresses', q: 'category=dress,jumpsuit', img: photoUrl('sundress-floral', 600) },
  { label: 'Footwear', q: 'category=footwear', img: photoUrl('sneaker-af1', 600) },
  { label: 'Knits & hoodies', q: 'category=sweater,hoodie', img: photoUrl('cardigan-yellow', 600) },
  { label: 'Bags', q: 'category=bag,accessory', img: photoUrl('bag-satchel-grey', 600) },
];

export default function Home() {
  useDocumentTitle(null);
  const { user } = useAuth();
  const { data: stats } = useFetch('/stats');
  const { data: latest, loading } = useFetch('/items', { params: { limit: 8, sort: 'newest' } });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="eyebrow">India’s clothing swap marketplace</p>
            <h1 className="mt-4 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Swap, <em className="font-normal italic text-moss">don’t</em> shop.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              List the clothes you no longer wear, discover fair swaps from people near you, and give every kurta, jacket and saree a second life.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? '/items/new' : '/register'} className="btn-primary px-6 py-3 text-base">
                {user ? 'List an item' : 'Start swapping — it’s free'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/browse" className="btn-secondary px-6 py-3 text-base">Browse clothes</Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              {[
                ['Items to swap', stats?.listings],
                ['Swaps completed', stats?.swaps],
                ['kg CO₂e avoided', stats?.impact?.co2],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 font-display text-3xl">{v == null ? '—' : fmtNum(v)}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div className="relative mx-auto grid w-full max-w-xl grid-cols-5 grid-rows-6 gap-3 sm:gap-4" style={{ height: 'min(560px, 120vw)' }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <img src={photoUrl('hero-rack', 1400)} alt="Shirts on a clothing rack" className="col-span-3 row-span-4 h-full w-full rounded-3xl object-cover shadow-card" />
            <img src={photoUrl('saree-green', 700)} alt="Sage green Kanjivaram saree" className="col-span-2 row-span-3 h-full w-full rounded-3xl object-cover shadow-card" />
            <img src={photoUrl('denim-jacket-1', 700)} alt="Denim trucker jacket" className="col-span-2 row-span-3 h-full w-full rounded-3xl object-cover shadow-card" />
            <img src={photoUrl('sneaker-af1', 700)} alt="White sneakers" className="col-span-3 row-span-2 h-full w-full rounded-3xl object-cover shadow-card" />
            <div className="absolute -left-2 bottom-24 hidden rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Fair match</p>
              <p className="mt-0.5 text-sm font-medium">Denim jacket ⇄ Kanjivaram</p>
              <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-sand"><div className="h-full w-[94%] rounded-full bg-moss" /></div>
              <p className="mt-1 text-xs text-moss">94% value match · 2.8 km away</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <div className="container-page">
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
          {CATS.map((c) => (
            <Link key={c.label} to={`/browse?${c.q}`} className="group relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl sm:h-40 sm:w-auto">
              <img src={c.img} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="container-page">
        <Section eyebrow="How it works" title="From closet clutter to a fair swap in four steps">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card relative p-6">
                <span className="absolute right-5 top-4 font-display text-5xl text-sand">{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-moss-soft text-moss">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Latest */}
      <div className="container-page">
        <Section
          eyebrow="Fresh in the closet"
          title="Just listed for swapping"
          action={<Link to="/browse" className="btn-secondary btn-sm">See all <ArrowRight className="h-3.5 w-3.5" /></Link>}
        >
          {loading ? (
            <ItemGridSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {latest?.items?.map((it) => <ItemCard key={it._id} item={it} />)}
            </div>
          )}
        </Section>
      </div>

      {/* Fair value + nearby */}
      <div className="container-page grid gap-4 py-6 lg:grid-cols-2">
        <div className="card overflow-hidden p-7 sm:p-9">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-clay-soft text-clay"><Scale className="h-5 w-5" /></span>
          <h3 className="mt-5 text-3xl">Fair swaps, without the haggling</h3>
          <p className="mt-3 text-muted">
            Our swap value calculator estimates what each piece is worth from its brand tier, condition, category and age — based on real resale ratios — so both sides can see a swap is balanced before agreeing.
          </p>
          <div className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">Levi’s trucker · Like new</span><span className="font-semibold">₹2,100</span></div>
            <div className="mt-2 flex justify-between"><span className="text-muted">Nike Air Force 1 · Good</span><span className="font-semibold">₹2,200</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full w-[95%] bg-moss" /></div>
            <p className="mt-2 text-xs font-medium text-moss">95% value match — Excellent swap</p>
          </div>
          <Link to="/calculator" className="btn-secondary mt-6">Try the calculator</Link>
        </div>
        <div className="card relative overflow-hidden p-7 sm:p-9">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-moss-soft text-moss"><MapPin className="h-5 w-5" /></span>
          <h3 className="mt-5 text-3xl">Swap with your neighbourhood</h3>
          <p className="mt-3 text-muted">
            Location-based matching shows people within a few kilometres who have something you’d like — and want something you have. Meet at a metro station, skip the shipping.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {['Distance-sorted listings & a live map', 'Suggestions scored on value, distance and fit', 'Approximate locations only — your address stays private'].map((t) => (
              <li key={t} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-moss" />{t}</li>
            ))}
          </ul>
          <Link to="/nearby" className="btn-primary mt-6">Explore swaps near you</Link>
        </div>
      </div>

      {/* Impact */}
      <div className="container-page">
        <section className="my-10 overflow-hidden rounded-4xl bg-moss text-white">
          <div className="grid grid-cols-1 gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Why swapping matters</p>
              <h2 className="mt-3 text-4xl leading-tight sm:text-5xl">India piles up about 7.8 million tonnes of textile waste every year.</h2>
              <p className="mt-4 max-w-lg text-white/80">
                Around half of it is post-consumer — clothes people simply stopped wearing. Every swap keeps a garment in use; researchers estimate reusing 1 kg of clothing avoids roughly 25 kg of CO₂e.
              </p>
              <p className="mt-4 text-xs text-white/60">Sources: Fashion for Good, “Wealth in Waste” (2022); INTEXTER–UPC study (2022).</p>
            </div>
            <div className="grid grid-cols-2 gap-3 self-center">
              {[
                [Recycle, `${fmtNum(stats?.impact?.kg ?? 0)} kg`, 'clothing kept in use by our community'],
                [Leaf, `${fmtNum(stats?.impact?.co2 ?? 0)} kg`, 'CO₂e emissions avoided'],
                [Droplets, `${fmtNum(Math.round((stats?.impact?.water ?? 0) / 1000))}k L`, 'water footprint saved'],
                [MapPin, fmtNum(stats?.cities ?? 0), 'cities swapping on ReThread'],
              ].map(([Icon, v, k]) => (
                <div key={k} className="rounded-2xl bg-white/10 p-5">
                  <Icon className="h-5 w-5 text-white/70" />
                  <p className="mt-3 font-display text-3xl">{v}</p>
                  <p className="mt-1 text-xs text-white/70">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      {!user && (
        <div className="container-page pb-6 text-center">
          <h2 className="text-4xl">Your next favourite outfit is already in someone’s closet.</h2>
          <Link to="/register" className="btn-clay mt-6 px-7 py-3 text-base">Create your free account</Link>
        </div>
      )}
    </>
  );
}
