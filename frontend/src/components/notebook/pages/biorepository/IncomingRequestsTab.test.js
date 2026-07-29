describe("IncomingRequestsTab", () => {
  test("loads pending requests from API endpoint path", () => {
    expect(
      "/rest/biorepository/retrieval/requests/pending?limit=100",
    ).toContain("pending");
  });
});
