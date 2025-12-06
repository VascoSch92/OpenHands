import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { selectOrganization } from "test-utils";
import ManageOrg from "#/routes/manage-org";
import { organizationService } from "#/api/organization-service/organization-service.api";
import SettingsScreen, { clientLoader } from "#/routes/settings";
import { resetOrgMockData } from "#/mocks/org-handlers";
import OptionService from "#/api/option-service/option-service.api";
import BillingService from "#/api/billing-service/billing-service.api";

function ManageOrgWithPortalRoot() {
  return (
    <div>
      <ManageOrg />
      <div data-testid="portal-root" id="portal-root" />
    </div>
  );
}

const RouteStub = createRoutesStub([
  {
    Component: () => <div data-testid="home-screen" />,
    path: "/",
  },
  {
    // @ts-expect-error - type mismatch
    loader: clientLoader,
    Component: SettingsScreen,
    path: "/settings",
    HydrateFallback: () => <div>Loading...</div>,
    children: [
      {
        Component: ManageOrgWithPortalRoot,
        path: "/settings/org",
      },
    ],
  },
]);

const renderManageOrg = () =>
  render(<RouteStub initialEntries={["/settings/org"]} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    ),
  });

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router", async () => ({
  ...(await vi.importActual("react-router")),
  useNavigate: () => navigateMock,
}));

describe("Manage Org Route", () => {
  beforeEach(() => {
    const getConfigSpy = vi.spyOn(OptionService, "getConfig");
    // @ts-expect-error - only return APP_MODE for these tests
    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset organization mock data to ensure clean state between tests
    resetOrgMockData();
    vi.clearAllMocks();
  });

  it("should render the available credits", async () => {
    renderManageOrg();
    await screen.findByTestId("manage-org-screen");

    await selectOrganization({ orgIndex: 0 });

    await waitFor(() => {
      const credits = screen.getByTestId("available-credits");
      expect(credits).toHaveTextContent("1000");
    });
  });

  it("should render account details", async () => {
    renderManageOrg();

    await selectOrganization({ orgIndex: 0 });

    await waitFor(() => {
      const orgName = screen.getByTestId("org-name");
      expect(orgName).toHaveTextContent("Acme Corp");

      const billingInfo = screen.getByTestId("billing-info");
      expect(billingInfo).toHaveTextContent("**** **** **** 1234");
    });
  });

  it("should be able to add credits", async () => {
    const createCheckoutSessionSpy = vi.spyOn(
      BillingService,
      "createCheckoutSession",
    );

    renderManageOrg();
    await screen.findByTestId("manage-org-screen");

    await selectOrganization({ orgIndex: 0 }); // user is owner in org 1

    expect(screen.queryByTestId("add-credits-form")).not.toBeInTheDocument();
    // Simulate adding credits
    const addCreditsButton = screen.getByText(/add/i);
    await userEvent.click(addCreditsButton);

    const addCreditsForm = screen.getByTestId("add-credits-form");
    expect(addCreditsForm).toBeInTheDocument();

    const amountInput = within(addCreditsForm).getByTestId("amount-input");
    const nextButton = within(addCreditsForm).getByRole("button", {
      name: /next/i,
    });

    await userEvent.type(amountInput, "1000");
    await userEvent.click(nextButton);

    // expect redirect to payment page
    expect(createCheckoutSessionSpy).toHaveBeenCalledWith(1000);

    await waitFor(() =>
      expect(screen.queryByTestId("add-credits-form")).not.toBeInTheDocument(),
    );
  });

  it("should close the modal when clicking cancel", async () => {
    const createCheckoutSessionSpy = vi.spyOn(
      BillingService,
      "createCheckoutSession",
    );
    renderManageOrg();
    await screen.findByTestId("manage-org-screen");

    await selectOrganization({ orgIndex: 0 }); // user is owner in org 1

    expect(screen.queryByTestId("add-credits-form")).not.toBeInTheDocument();
    // Simulate adding credits
    const addCreditsButton = screen.getByText(/add/i);
    await userEvent.click(addCreditsButton);

    const addCreditsForm = screen.getByTestId("add-credits-form");
    expect(addCreditsForm).toBeInTheDocument();

    const cancelButton = within(addCreditsForm).getByRole("button", {
      name: /cancel/i,
    });

    await userEvent.click(cancelButton);

    expect(screen.queryByTestId("add-credits-form")).not.toBeInTheDocument();
    expect(createCheckoutSessionSpy).not.toHaveBeenCalled();
  });

  describe("AddCreditsModal", () => {
    const openAddCreditsModal = async () => {
      const user = userEvent.setup();
      renderManageOrg();
      await screen.findByTestId("manage-org-screen");

      await selectOrganization({ orgIndex: 0 }); // user is owner in org 1

      const addCreditsButton = screen.getByText(/add/i);
      await user.click(addCreditsButton);

      const addCreditsForm = screen.getByTestId("add-credits-form");
      expect(addCreditsForm).toBeInTheDocument();

      return { user, addCreditsForm };
    };

    describe("Input Validation & Error Messages", () => {
      it("should not display error message when input is empty", async () => {
        await openAddCreditsModal();

        const errorMessage = screen.queryByTestId("amount-error");
        expect(errorMessage).not.toBeInTheDocument();
      });

      it("should display error message for negative amount", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "-50");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_NEGATIVE_AMOUNT",
          );
        });
      });

      it("should display error message for amount less than minimum", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "9");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MINIMUM_AMOUNT",
          );
        });
      });

      it("should display error message for amount greater than maximum", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "25001");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MAXIMUM_AMOUNT",
          );
        });
      });

      it("should display error message for decimal values", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "50.5");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MUST_BE_WHOLE_NUMBER",
          );
        });
      });

      it("should clear error message when input becomes valid", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        // Enter invalid value
        await user.type(amountInput, "9");
        await waitFor(() => {
          expect(screen.getByTestId("amount-error")).toBeInTheDocument();
        });

        // Clear and enter valid value
        await user.clear(amountInput);
        await user.type(amountInput, "100");

        await waitFor(() => {
          const errorMessage = screen.queryByTestId("amount-error");
          expect(errorMessage).not.toBeInTheDocument();
        });
      });

      it("should not display error message when input is valid", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "100");

        await waitFor(() => {
          const errorMessage = screen.queryByTestId("amount-error");
          expect(errorMessage).not.toBeInTheDocument();
        });
      });
    });

    describe("Button State Management", () => {
      it("should disable submit button initially", async () => {
        await openAddCreditsModal();

        const nextButton = screen.getByRole("button", { name: /next/i });
        expect(nextButton).toBeDisabled();
      });

      it("should disable submit button when input is invalid", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "9");

        const nextButton = screen.getByRole("button", { name: /next/i });
        expect(nextButton).toBeDisabled();
      });

      it("should enable submit button when input is valid", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "100");

        await waitFor(() => {
          const nextButton = screen.getByRole("button", { name: /next/i });
          expect(nextButton).not.toBeDisabled();
        });
      });

      it("should disable submit button during pending state", async () => {
        const createCheckoutSessionSpy = vi
          .spyOn(BillingService, "createCheckoutSession")
          .mockImplementation(() => new Promise(() => {})); // Never resolves

        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "100");
        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.click(nextButton);

        // Button should be disabled after clicking (while pending)
        await waitFor(() => {
          expect(nextButton).toBeDisabled();
        });
      });

      it("should disable submit button after successful submission", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "100");
        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.click(nextButton);

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
        });
      });
    });

    describe("Input Attributes & Placeholder", () => {
      it("should have min attribute set to 10", async () => {
        await openAddCreditsModal();

        const amountInput = screen.getByTestId("amount-input");
        expect(amountInput).toHaveAttribute("min", "10");
      });

      it("should have max attribute set to 25000", async () => {
        await openAddCreditsModal();

        const amountInput = screen.getByTestId("amount-input");
        expect(amountInput).toHaveAttribute("max", "25000");
      });

      it("should have step attribute set to 1", async () => {
        await openAddCreditsModal();

        const amountInput = screen.getByTestId("amount-input");
        expect(amountInput).toHaveAttribute("step", "1");
      });

      it("should display correct placeholder text", async () => {
        await openAddCreditsModal();

        const amountInput = screen.getByTestId("amount-input");
        expect(amountInput).toHaveAttribute(
          "placeholder",
          "PAYMENT$SPECIFY_AMOUNT_USD",
        );
      });
    });

    describe("Form Submission Behavior", () => {
      it("should prevent submission when amount is invalid", async () => {
        const createCheckoutSessionSpy = vi.spyOn(
          BillingService,
          "createCheckoutSession",
        );
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "9");
        await user.click(nextButton);

        expect(createCheckoutSessionSpy).not.toHaveBeenCalled();
      });

      it("should call createCheckoutSession with correct amount when valid", async () => {
        const createCheckoutSessionSpy = vi.spyOn(
          BillingService,
          "createCheckoutSession",
        );
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "1000");
        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.click(nextButton);

        expect(createCheckoutSessionSpy).toHaveBeenCalledWith(1000);
      });

      it("should not call createCheckoutSession when validation fails", async () => {
        const createCheckoutSessionSpy = vi.spyOn(
          BillingService,
          "createCheckoutSession",
        );
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "-50");

        // Button should be disabled, but even if we try to submit, it shouldn't work
        expect(nextButton).toBeDisabled();

        // Verify mutation was not called
        expect(createCheckoutSessionSpy).not.toHaveBeenCalled();
      });

      it("should close modal on successful submission", async () => {
        const createCheckoutSessionSpy = vi
          .spyOn(BillingService, "createCheckoutSession")
          .mockResolvedValue("https://checkout.stripe.com/test-session");

        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "1000");
        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.click(nextButton);

        expect(createCheckoutSessionSpy).toHaveBeenCalledWith(1000);

        await waitFor(() => {
          expect(
            screen.queryByTestId("add-credits-form"),
          ).not.toBeInTheDocument();
        });
      });

      it("should reset form state after submission", async () => {
        const createCheckoutSessionSpy = vi
          .spyOn(BillingService, "createCheckoutSession")
          .mockResolvedValue("https://checkout.stripe.com/test-session");

        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "1000");
        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.click(nextButton);

        // After submission, the button should be disabled
        // Note: The modal closes on success, so we can't check the input value
        // but we can verify the button state before the modal closes
        await waitFor(() => {
          expect(nextButton).toBeDisabled();
        });

        expect(createCheckoutSessionSpy).toHaveBeenCalledWith(1000);
      });
    });

    describe("Real-time Validation", () => {
      it("should validate on input change", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "5");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toBeInTheDocument();
        });
      });

      it("should update button state on input change", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        expect(nextButton).toBeDisabled();

        await user.type(amountInput, "100");

        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
        });

        await user.clear(amountInput);
        await user.type(amountInput, "5");

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
        });
      });

      it("should update error message on input change", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "5");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MINIMUM_AMOUNT",
          );
        });

        await user.clear(amountInput);
        await user.type(amountInput, "25001");

        await waitFor(() => {
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MAXIMUM_AMOUNT",
          );
        });
      });

      it("should handle rapid input changes correctly", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");

        await user.type(amountInput, "1");
        await user.type(amountInput, "0");
        await user.type(amountInput, "0");

        await waitFor(() => {
          const nextButton = screen.getByRole("button", { name: /next/i });
          expect(nextButton).not.toBeDisabled();
          const errorMessage = screen.queryByTestId("amount-error");
          expect(errorMessage).not.toBeInTheDocument();
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle boundary value at minimum (10)", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "10");

        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
          const errorMessage = screen.queryByTestId("amount-error");
          expect(errorMessage).not.toBeInTheDocument();
        });
      });

      it("should handle boundary value at maximum (25000)", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "25000");

        await waitFor(() => {
          expect(nextButton).not.toBeDisabled();
          const errorMessage = screen.queryByTestId("amount-error");
          expect(errorMessage).not.toBeInTheDocument();
        });
      });

      it("should handle value just below minimum (9)", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "9");

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MINIMUM_AMOUNT",
          );
        });
      });

      it("should handle value just above maximum (25001)", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "25001");

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MAXIMUM_AMOUNT",
          );
        });
      });

      it("should handle zero value", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "0");

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MINIMUM_AMOUNT",
          );
        });
      });

      it("should handle very large numbers", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        await user.type(amountInput, "999999");

        await waitFor(() => {
          expect(nextButton).toBeDisabled();
          const errorMessage = screen.getByTestId("amount-error");
          expect(errorMessage).toHaveTextContent(
            "PAYMENT$ERROR_MAXIMUM_AMOUNT",
          );
        });
      });

      it("should handle whitespace-only input", async () => {
        const { user } = await openAddCreditsModal();
        const amountInput = screen.getByTestId("amount-input");
        const nextButton = screen.getByRole("button", { name: /next/i });

        // Type spaces (though number input may not accept this, testing the logic)
        await user.type(amountInput, "   ");

        expect(nextButton).toBeDisabled();
        const errorMessage = screen.queryByTestId("amount-error");
        expect(errorMessage).not.toBeInTheDocument();
      });
    });
  });

  it("should NOT show add credits option for ADMIN role", async () => {
    renderManageOrg();
    await screen.findByTestId("manage-org-screen");

    await selectOrganization({ orgIndex: 2 }); // user is admin in org 3

    // Verify credits are shown
    await waitFor(() => {
      const credits = screen.getByTestId("available-credits");
      expect(credits).toBeInTheDocument();
    });

    // Verify add credits button is not present
    const addButton = screen.queryByText(/add/i);
    expect(addButton).not.toBeInTheDocument();
  });

  describe("actions", () => {
    it("should be able to update the organization name", async () => {
      const updateOrgNameSpy = vi.spyOn(
        organizationService,
        "updateOrganization",
      );
      const getConfigSpy = vi.spyOn(OptionService, "getConfig");

      // @ts-expect-error - only return the properties we need for this test
      getConfigSpy.mockResolvedValue({
        APP_MODE: "saas", // required to enable getMe
      });

      renderManageOrg();
      await screen.findByTestId("manage-org-screen");

      await selectOrganization({ orgIndex: 0 });

      const orgName = screen.getByTestId("org-name");
      await waitFor(() => expect(orgName).toHaveTextContent("Acme Corp"));

      expect(
        screen.queryByTestId("update-org-name-form"),
      ).not.toBeInTheDocument();

      const changeOrgNameButton = within(orgName).getByRole("button", {
        name: /change/i,
      });
      await userEvent.click(changeOrgNameButton);

      const orgNameForm = screen.getByTestId("update-org-name-form");
      const orgNameInput = within(orgNameForm).getByRole("textbox");
      const saveButton = within(orgNameForm).getByRole("button", {
        name: /save/i,
      });

      await userEvent.type(orgNameInput, "New Org Name");
      await userEvent.click(saveButton);

      expect(updateOrgNameSpy).toHaveBeenCalledWith({
        orgId: "1",
        name: "New Org Name",
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("update-org-name-form"),
        ).not.toBeInTheDocument();
        expect(orgName).toHaveTextContent("New Org Name");
      });
    });

    it("should NOT allow roles other than owners to change org name", async () => {
      renderManageOrg();
      await screen.findByTestId("manage-org-screen");

      await selectOrganization({ orgIndex: 2 }); // user is admin in org 3

      const orgName = screen.getByTestId("org-name");
      const changeOrgNameButton = within(orgName).queryByRole("button", {
        name: /change/i,
      });
      expect(changeOrgNameButton).not.toBeInTheDocument();
    });

    it("should NOT allow roles other than owners to delete an organization", async () => {
      const getConfigSpy = vi.spyOn(OptionService, "getConfig");
      // @ts-expect-error - only return the properties we need for this test
      getConfigSpy.mockResolvedValue({
        APP_MODE: "saas", // required to enable getMe
      });

      renderManageOrg();
      await screen.findByTestId("manage-org-screen");

      await selectOrganization({ orgIndex: 2 }); // user is admin in org 3

      const deleteOrgButton = screen.queryByRole("button", {
        name: /ORG\$DELETE_ORGANIZATION/i,
      });
      expect(deleteOrgButton).not.toBeInTheDocument();
    });

    it("should be able to delete an organization", async () => {
      const deleteOrgSpy = vi.spyOn(organizationService, "deleteOrganization");

      renderManageOrg();
      await screen.findByTestId("manage-org-screen");

      await selectOrganization({ orgIndex: 0 });

      expect(
        screen.queryByTestId("delete-org-confirmation"),
      ).not.toBeInTheDocument();

      const deleteOrgButton = screen.getByRole("button", {
        name: /ORG\$DELETE_ORGANIZATION/i,
      });
      await userEvent.click(deleteOrgButton);

      const deleteConfirmation = screen.getByTestId("delete-org-confirmation");
      const confirmButton = within(deleteConfirmation).getByRole("button", {
        name: /BUTTON\$CONFIRM/i,
      });

      await userEvent.click(confirmButton);

      expect(deleteOrgSpy).toHaveBeenCalledWith({ orgId: "1" });
      expect(
        screen.queryByTestId("delete-org-confirmation"),
      ).not.toBeInTheDocument();

      // expect to have navigated to home screen
      await screen.findByTestId("home-screen");
    });

    it.todo("should be able to update the organization billing info");
  });
});
