/* Example content for the parts that read data — product cards (data-bs) and the collage (data-pf).
   Replace it with this deck's own and delete what the deck does not use. Paths are relative to the deck .html.
   Product card: only img is required. qty "TOP: 12,000 PCS" = small label + number + small unit.
   Collage item: a cut-out (transparent background) with its pixel size w × h; "back": true = stands behind. */
window.DECK_DATA = {
 "bestsellers": {
  "product": { "cards": [
   { "img": "assets/img/products/product-1.webp", "logo": "assets/img/brands/brand-b.webp", "retailer": "Brand B", "season": "SU’27",
     "spec": ["COTTON POPLIN", "100% COTTON"], "qty": ["38,000 PCS"] },
   { "img": "assets/img/products/product-2.webp", "logo": "assets/img/brands/brand-e.webp", "retailer": "Brand E", "season": "SU’27",
     "spec": ["LINEN BLEND", "55% LINEN 45% RAYON"], "qty": ["24,000 PCS"] },
   { "img": "assets/img/products/product-3.webp", "logo": "assets/img/brands/brand-f.webp", "retailer": "Brand F", "season": "FA’27",
     "spec": ["SATIN JACQUARD", "100% POLYESTER"], "qty": ["TOP: 12,000 PCS", "SET: 6,000 PCS"] },
   { "img": "assets/img/products/product-4.webp", "logo": "assets/img/brands/brand-j.webp", "retailer": "Brand J", "season": "FA’27",
     "spec": ["CREPE", "100% RAYON"], "qty": ["9,500 PCS"] }
  ] }
 },
 "portfolio": {
  "collage": [
   { "label": "Tops", "items": [
    {"img": "assets/img/figures/figure-01.webp", "w": 253, "h": 826},
    {"img": "assets/img/figures/figure-02.webp", "w": 206, "h": 802},
    {"img": "assets/img/figures/figure-03.webp", "w": 196, "h": 839},
    {"img": "assets/img/figures/figure-04.webp", "w": 234, "h": 820},
    {"img": "assets/img/figures/figure-05.webp", "w": 234, "h": 824},
    {"img": "assets/img/figures/figure-06.webp", "w": 227, "h": 816},
    {"img": "assets/img/figures/figure-07.webp", "w": 213, "h": 883},
    {"img": "assets/img/figures/figure-08.webp", "w": 209, "h": 792}
   ] },
   { "label": "Dresses", "items": [
    {"img": "assets/img/figures/figure-09.webp", "w": 227, "h": 844},
    {"img": "assets/img/figures/figure-10.webp", "w": 228, "h": 764},
    {"img": "assets/img/figures/figure-11.webp", "w": 232, "h": 811},
    {"img": "assets/img/figures/figure-12.webp", "w": 197, "h": 788},
    {"img": "assets/img/figures/figure-13.webp", "w": 212, "h": 815},
    {"img": "assets/img/figures/figure-14.webp", "w": 212, "h": 747},
    {"img": "assets/img/figures/figure-15.webp", "w": 216, "h": 767},
    {"img": "assets/img/figures/figure-16.webp", "w": 197, "h": 772},
    {"img": "assets/img/figures/figure-17.webp", "w": 261, "h": 834}
   ] },
   { "label": "Skirts", "items": [
    {"img": "assets/img/figures/figure-18.webp", "w": 207, "h": 776},
    {"img": "assets/img/figures/figure-19.webp", "w": 222, "h": 762},
    {"img": "assets/img/figures/figure-20.webp", "w": 207, "h": 857},
    {"img": "assets/img/figures/figure-21.webp", "w": 236, "h": 781},
    {"img": "assets/img/figures/figure-22.webp", "w": 238, "h": 860},
    {"img": "assets/img/figures/figure-23.webp", "w": 251, "h": 779},
    {"img": "assets/img/figures/figure-24.webp", "w": 190, "h": 767}
   ] }
  ]
 }
};
