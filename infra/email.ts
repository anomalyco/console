import { domain, zone } from "./dns";

export const email = new sst.aws.Email("Email", {
  sender: domain,
  dns: sst.aws.dns({
    override: true,
  }),
});

// export const email = new sst.Linkable("Email", {
//   properties: {
//     sender: domain,
//   },
// });

// new aws.route53.Record("MX", {
//   name: domain,
//   zoneId: zone.zoneId,
//   type: "MX",
//   ttl: 60,
//   records: [
//     "aspmx.l.google.com.",
//     "alt1.aspmx.l.google.com.",
//     "alt2.aspmx.l.google.com.",
//     "alt3.aspmx.l.google.com.",
//     "alt4.aspmx.l.google.com.",
//   ],
// });
