export function MobileScreen({

active,

children,

}: {

active: boolean;

children: React.ReactNode;

}) {

if (!active) return null;

return <section className="mobile-section safe-bottom">{children}</section>;

}
