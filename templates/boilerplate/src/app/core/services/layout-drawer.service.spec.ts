import { TestBed } from "@angular/core/testing";
import { Component } from "@angular/core";
import { LayoutDrawerService } from "./layout-drawer.service";

@Component({ standalone: true, template: "" })
class DummyPanelComponent {}

describe("LayoutDrawerService", () => {
  let service: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutDrawerService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should start closed and empty", () => {
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBeNull();
    expect(service.actions()).toEqual([]);
  });

  it("open() should set component, title and open state", () => {
    service.open(DummyPanelComponent, "Detalle", "info");
    expect(service.isOpen()).toBe(true);
    expect(service.component()).toBe(DummyPanelComponent);
    expect(service.title()).toBe("Detalle");
    expect(service.icon()).toBe("info");
  });

  it("actions() should never be undefined even when open() omits them", () => {
    service.open(DummyPanelComponent, "Detalle");
    expect(service.actions()).toEqual([]);
  });

  it("setActions() should update actions without closing the drawer", () => {
    service.open(DummyPanelComponent, "Detalle");
    service.setActions([{ label: "Guardar", icon: "save", callback: () => {} }]);
    expect(service.actions()).toHaveLength(1);
    expect(service.isOpen()).toBe(true);
  });

  it("close() should NOT drop the component — the exit animation still needs it", () => {
    // Este es el contrato entero del servicio: si close() limpiara el componente,
    // la vista desapareceria de golpe y la animacion de salida GSAP no tendria
    // nada que animar. Por eso close() y clear() estan separados.
    service.open(DummyPanelComponent, "Detalle");
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBe(DummyPanelComponent);
  });

  it("clear() should destroy the rendered component", () => {
    service.open(DummyPanelComponent, "Detalle");
    service.close();
    service.clear();
    expect(service.component()).toBeNull();
  });
});
