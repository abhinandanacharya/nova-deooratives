<?php
/**
 * Example: PHP Controller -> View with nova-deooratives (MyLang)
 *
 * Controller passes $users (and $title) to the View.
 * The View uses <script type="text/mylang" data-scope='...'> to render
 * a full HTML table with loops, conditionals, and totals—without writing
 * messy <?php foreach (...) : ?> blocks inside HTML!
 */

// ── 1. CONTROLLER (e.g. UserController.php) ──────────────────
$title = "Team Directory";
$users = [
    ["id" => 101, "name" => "Abhinandan Acharya", "role" => "Admin",     "salary" => 95000, "active" => true],
    ["id" => 102, "name" => "Priya Sharma",       "role" => "Developer", "salary" => 82000, "active" => true],
    ["id" => 103, "name" => "Rahul Verma",        "role" => "Designer",  "salary" => 70000, "active" => false],
    ["id" => 104, "name" => "Sneha Patel",        "role" => "Manager",   "salary" => 90000, "active" => true],
];

// Pass data safely as JSON for the View
$viewData = json_encode(
    ["title" => $title, "users" => $users],
    JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title><?= htmlspecialchars($title) ?></title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e2e8f0; padding: 32px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #2d3748; padding: 10px 14px; text-align: left; }
    th { background: #1a1f36; color: #a78bfa; }
    .active { color: #34d399; font-weight: 600; }
    .inactive { color: #f87171; }
  </style>
</head>
<body>

  <!-- ── 2. VIEW (passes PHP array via data-scope) ── -->
  <script src="https://cdn.jsdelivr.net/npm/nova-deooratives/dist/mylang.umd.min.js"></script>

  <script type="text/mylang" data-scope='<?= $viewData ?>'>
    <h1>{{ title }} ({{ len(users) }} members)</h1>

    <!-- Calculate total payroll using <reduce> -->
    <reduce data="users" acc="sum" init="0" item="u" expr="sum + u.salary" save="totalPayroll" />

    <!-- Filter active users -->
    <filter data="users" where="$v.active" save="activeUsers"></filter>
    <p>Active: <b>{{ len(activeUsers) }}</b> | Total Payroll: <b>${{ totalPayroll }}</b></p>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>ID</th>
          <th>Name</th>
          <th>Role</th>
          <th>Salary</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <for of="users" as="u" index="i">
          <tr>
            <td>{{ i + 1 }}</td>
            <td>#{{ u.id }}</td>
            <td><b>{{ u.name }}</b></td>
            <td>
              <switch value="u.role">
                <case match="'Admin'"><span>🛡️ Admin</span></case>
                <case match="'Manager'"><span>📋 Manager</span></case>
                <default><span>💻 {{ u.role }}</span></default>
              </switch>
            </td>
            <td>${{ u.salary }}</td>
            <td>
              <if cond="u.active">
                <span class="active">● Active</span>
                <else><span class="inactive">○ Inactive</span></else>
              </if>
            </td>
          </tr>
        </for>
      </tbody>
    </table>
  </script>

</body>
</html>
