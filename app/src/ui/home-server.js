/* The family's Orlis server, on the internet (Tailscale Funnel on the
   owner's laptop). Orlis Play looks for a server on this PC's Wi-Fi first;
   if there's none, it tries this - so someone setting up at their own home
   just installs and makes an account, with nothing to type.

   The address isn't a secret (anyone can ask to join; the owner lets them
   in or not). Another family's own build would put their address here, or
   null for none. */
export const HOME_SERVER = 'https://orlis.tailb28684.ts.net';
