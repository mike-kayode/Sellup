"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const testimonials = [
  {
    quote:
      "Sell Up helped me take my business online in less than 10 minutes. I now get orders every day on WhatsApp.",
    name: "Amaka Okafor",
    role: "CEO, Amaka's Treats",
    initials: "AO",
  },
  {
    quote:
      "Setting up was so easy and everything works perfectly on my phone. My customers love how simple it is to order.",
    name: "Blessing Okafar",
    role: "Fashion Store Owner",
    initials: "BO",
  },
  {
    quote:
      "The support team is always there when I need help. Sell Up makes running my business so much simpler.",
    name: "Tunde Adebayo",
    role: "Food Business Owner",
    initials: "TA",
  },
];

export function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const active = testimonials[index];

  const showPrevious = () =>
    setIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  const showNext = () => setIndex((current) => (current + 1) % testimonials.length);

  return (
    <div className="relative rounded-2xl border border-[#d5efdb] bg-white p-5 shadow-[0_24px_70px_-42px_rgba(18,140,126,0.45)] sm:p-6 lg:p-8">
      <span className="text-4xl leading-none text-[#25D366] sm:text-5xl">“</span>
      <blockquote className="mt-1 text-base font-semibold leading-7 text-slate-950 sm:text-lg lg:text-xl">
        {active.quote}
      </blockquote>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-sm font-bold text-white">
            {active.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{active.name}</p>
            <p className="truncate text-xs text-slate-500">{active.role}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Previous testimonial"
            onClick={showPrevious}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#25D366] hover:text-[#128C7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next testimonial"
            onClick={showNext}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#25D366] hover:text-[#128C7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5">
        {testimonials.map((testimonial, position) => (
          <button
            key={testimonial.name}
            type="button"
            aria-label={`Show testimonial from ${testimonial.name}`}
            onClick={() => setIndex(position)}
            className={`h-1.5 rounded-full transition-all ${
              position === index ? "w-6 bg-[#25D366]" : "w-1.5 bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}