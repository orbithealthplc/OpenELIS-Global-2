import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import ShipmentListTable from "./ShipmentListTable";
import messages from "../../../../languages/en.json";

jest.mock("../../../utils/Utils", () => ({
  getFromOpenElisServer: jest.fn(),
}));

import { getFromOpenElisServer } from "../../../utils/Utils";

const renderWithIntl = (ui) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      {ui}
    </IntlProvider>,
  );

describe("ShipmentListTable", () => {
  beforeEach(() => {
    getFromOpenElisServer.mockReset();
  });

  test("lists existing shipments and continues verified ones to registration", async () => {
    const onSelect = jest.fn();
    getFromOpenElisServer.mockImplementation((_url, callback) => {
      callback([
        {
          id: 47,
          deliveryReference: "cda",
          senderName: "Lab A",
          expectedSampleCount: 10,
          receptionTimestamp: Date.now(),
          status: "RECEIVED",
          documentationStatus: "VERIFIED",
        },
        {
          id: 48,
          deliveryReference: "pending-ref",
          senderName: "Lab B",
          expectedSampleCount: 2,
          receptionTimestamp: Date.now(),
          status: "RECEIVED",
          documentationStatus: "PENDING",
        },
      ]);
    });

    await act(async () => {
      renderWithIntl(
        <ShipmentListTable
          onSelect={onSelect}
          showDocStatus
          selectedShipmentId={null}
        />,
      );
    });

    expect(screen.getByText("Continue to Sample Registration")).toBeTruthy();
    expect(screen.getByText("Continue to Documentation")).toBeTruthy();
    expect(screen.getByText("cda")).toBeTruthy();

    fireEvent.click(screen.getByText("Continue to Sample Registration"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 47, documentationStatus: "VERIFIED" }),
    );
  });

  test("shows load error instead of empty state when request fails", async () => {
    getFromOpenElisServer.mockImplementation((_url, callback) => {
      callback(undefined);
    });

    await act(async () => {
      renderWithIntl(<ShipmentListTable showDocStatus />);
    });

    expect(screen.getByText("Failed to load shipments")).toBeTruthy();
    expect(screen.queryByText("No Shipments")).toBeNull();
  });

  test("does not pass a third argument as AbortSignal to getFromOpenElisServer", async () => {
    getFromOpenElisServer.mockImplementation((_url, callback) => {
      callback([]);
    });

    await act(async () => {
      renderWithIntl(<ShipmentListTable />);
    });

    expect(getFromOpenElisServer).toHaveBeenCalled();
    expect(getFromOpenElisServer.mock.calls[0]).toHaveLength(2);
  });
});
