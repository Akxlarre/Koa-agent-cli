import { TestBed } from "@angular/core/testing";
import { MessageService } from "primeng/api";
import { ToastService } from "./toast.service";

describe("ToastService", () => {
  let service: ToastService;
  let messageService: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messageService = { add: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: messageService }],
    });
    service = TestBed.inject(ToastService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("success() should use severity success", () => {
    service.success("Guardado");
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success", summary: "Guardado" }),
    );
  });

  it("error() should use severity error", () => {
    service.error("Fallo", "detalle");
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error", summary: "Fallo", detail: "detalle" }),
    );
  });

  it("warning() should map to severity warn (not 'warning')", () => {
    service.warning("Cuidado");
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "warn" }),
    );
  });

  it("info() should use severity info", () => {
    service.info("Dato");
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "info" }),
    );
  });

  it("should give errors a longer life than the rest", () => {
    // Un error necesita mas tiempo en pantalla que una confirmacion: el usuario
    // tiene que leerlo y decidir. Si las duraciones se igualan, se pierde.
    service.error("Fallo");
    const errorLife = messageService.add.mock.calls[0][0].life;
    service.success("Ok");
    const successLife = messageService.add.mock.calls[1][0].life;
    expect(errorLife).toBeGreaterThan(successLife);
  });

  it("should default detail to empty string", () => {
    service.success("Solo summary");
    expect(messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "" }),
    );
  });
});
