import { Main } from '../../components/elements';
import { HomeNavbar } from '../../components/navbar';
import { HeroSection } from '../../components/home/hero';
import { FeaturesSection } from '../../components/home/features';
import { StatsSection } from '../../components/home/stats';
import { TestimonialsSection } from '../../components/home/testimonials';
import { FAQsSection } from '../../components/home/faqs';
import { CallToActionSection } from '../../components/home/call-to-action';
import { FooterSection } from '../../components/home/footer';
import {RegistrySection} from "@/components/home/registry-section";

export default function Page() {
  return (
    <>
      <HomeNavbar />
      <Main>
        <HeroSection />
        <FeaturesSection />
        <RegistrySection />
        <StatsSection />
        <FAQsSection />
        <TestimonialsSection />
        <CallToActionSection />
      </Main>
      <FooterSection />
    </>
  );
}
