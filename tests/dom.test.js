/**
 * @jest-environment jsdom
 */
const MyLang = require("../dist/mylang.umd.js");

describe("DOM Rendering (UMD)", () => {
  test("renders nested <for> inside <table> without foster-parenting", () => {
    const out = document.createElement("div");
    MyLang.render(
      `<table><for range="1,4" as="row"><tr><for range="1,4" as="col"><td>{{ row*col }}</td></for></tr></for></table>`,
      out
    );
    expect(out.innerHTML).toBe(
      "<table><tr><td>1</td><td>2</td><td>3</td></tr><tr><td>2</td><td>4</td><td>6</td></tr><tr><td>3</td><td>6</td><td>9</td></tr></table>"
    );
  });

  test("renders self-closing <let /> and <while> loop", () => {
    const out = document.createElement("div");
    MyLang.render(
      `<let name="n" value="1" /><while cond="n <= 8"><span>{{ n }} </span><let name="n" value="n*2" upper /></while>`,
      out
    );
    expect(out.innerHTML).toBe("<span>1 </span><span>2 </span><span>4 </span><span>8 </span>");
  });

  test("handles > inside attribute expressions (<if cond='x > 5'>)", () => {
    const out = document.createElement("div");
    MyLang.render(
      `<let name="x" value="10" /><if cond="x > 5"><p>big</p><else><p>small</p></else></if>`,
      out
    );
    expect(out.innerHTML).toBe("<p>big</p>");
  });

  test("renders <script type='text/mylang' data-scope='...'> for PHP/Python/Node", () => {
    document.body.innerHTML = `
      <div id="target"></div>
      <script type="text/mylang" target="#target" data-scope='{"users":[{"name":"Alice"},{"name":"Bob"}]}'>
        <ul><for of="users" as="u"><li>{{ u.name }}</li></for></ul>
      </script>
    `;
    MyLang.mount();
    expect(document.getElementById("target").innerHTML.trim()).toBe(
      "<ul><li>Alice</li><li>Bob</li></ul>"
    );
  });
});
