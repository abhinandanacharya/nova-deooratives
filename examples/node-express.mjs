/**
 * Example: Node.js / Express Controller -> View with nova-deooratives
 * Passes server-side array data into a view rendered by nova-deooratives.
 */
import http from "node:http";

const orders = [
  { id: "ORD-01", customer: "Alice", total: 120.5, paid: true },
  { id: "ORD-02", customer: "Bob",   total: 45.0,  paid: false },
  { id: "ORD-03", customer: "Carol", total: 299.99, paid: true },
];

const server = http.createServer((req, res) => {
  const scopeJson = JSON.stringify({ orders }).replace(/'/g, "&#39;");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Node.js + nova-deooratives</title>
  <script src="https://cdn.jsdelivr.net/npm/nova-deooratives/dist/mylang.umd.min.js"></script>
</head>
<body>
  <script type="text/mylang" data-scope='${scopeJson}'>
    <h1>Orders ({{ len(orders) }})</h1>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr>
      <for of="orders" as="o">
        <tr>
          <td>{{ o.id }}</td>
          <td>{{ o.customer }}</td>
          <td>\${{ o.total }}</td>
          <td>
            <if cond="o.paid">✅ Paid<else>⏳ Pending</else></if>
          </td>
        </tr>
      </for>
    </table>
  </script>
</body>
</html>`);
});

server.listen(3000, () => console.log("Listening on http://localhost:3000"));
